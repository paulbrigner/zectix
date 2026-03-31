import { describe, expect, it } from "vitest";
import type { TenantOpsDetail } from "@/lib/tenancy/service";
import { buildOnboardingChecklist } from "@/lib/tenant-self-serve";
import {
  makeCalendarConnection,
  makeCipherPayConnection,
  makeEventMirror,
  makeTenant,
  makeTicketMirror,
} from "@/tests/test-helpers";

type TenantBillingDetail = NonNullable<TenantOpsDetail["billing"]>;

function makeDetail(input?: {
  calendars?: ReturnType<typeof makeCalendarConnection>[];
  cipherpayConnections?: ReturnType<typeof makeCipherPayConnection>[];
  events?: ReturnType<typeof makeEventMirror>[];
  tenant?: ReturnType<typeof makeTenant>;
  ticketsByEvent?: Map<string, ReturnType<typeof makeTicketMirror>[]>;
}): TenantOpsDetail {
  const tenant = input?.tenant || makeTenant();
  const calendars = input?.calendars || [];
  const events = input?.events || [];
  const ticketsByEvent =
    input?.ticketsByEvent ||
    new Map(
      events.map((event) => [
        event.event_api_id,
        [],
      ] as const),
    );

  const billing: TenantBillingDetail = {
    tenant,
    current_cycle: null as unknown as TenantBillingDetail["current_cycle"],
    cycles: [],
    adjustments_by_cycle: new Map(),
  };

  return {
    tenant,
    calendars,
    cipherpay_connections: input?.cipherpayConnections || [],
    sessions: [],
    webhooks: [],
    tasks: [],
    events: calendars.map((calendar) => ({
      calendar,
      events: events.filter(
        (event) => event.calendar_connection_id === calendar.calendar_connection_id,
      ),
    })),
    tickets_by_event: ticketsByEvent,
    calendar_secret_previews: new Map(),
    cipherpay_secret_previews: new Map(),
    upstream_luma_events_by_calendar: new Map(),
    active_cipherpay_connections_by_calendar: new Map(),
    billing,
  };
}

describe("buildOnboardingChecklist", () => {
  it("starts with only the draft organizer step complete for a fresh draft", () => {
    const checklist = buildOnboardingChecklist(
      makeDetail({
        tenant: makeTenant({
          status: "draft",
          onboarding_status: "in_progress",
        }),
      }),
    );

    expect(checklist.map((item) => item.complete)).toEqual([
      true,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it("marks the connect calendar step complete once any calendar exists", () => {
    const checklist = buildOnboardingChecklist(
      makeDetail({
        tenant: makeTenant({
          status: "draft",
          onboarding_status: "in_progress",
        }),
        calendars: [
          makeCalendarConnection({
            status: "pending_validation",
            last_validated_at: null,
          }),
        ],
      }),
    );

    expect(
      checklist.find((item) => item.stepId === "connect_luma_calendar")?.complete,
    ).toBe(true);
    expect(
      checklist.find((item) => item.stepId === "validate_sync_luma")?.complete,
    ).toBe(false);
  });

  it("requires an active, validated calendar for the sync validation step", () => {
    const checklist = buildOnboardingChecklist(
      makeDetail({
        calendars: [
          makeCalendarConnection({
            status: "active",
            last_validated_at: "2026-03-24T12:00:00.000Z",
          }),
        ],
      }),
    );

    expect(
      checklist.find((item) => item.stepId === "validate_sync_luma")?.complete,
    ).toBe(true);
  });

  it("tracks CipherPay attachment and validation separately", () => {
    const attachedOnly = buildOnboardingChecklist(
      makeDetail({
        cipherpayConnections: [
          makeCipherPayConnection({
            status: "pending_validation",
            last_validated_at: null,
          }),
        ],
      }),
    );

    expect(
      attachedOnly.find((item) => item.stepId === "attach_cipherpay")?.complete,
    ).toBe(true);
    expect(
      attachedOnly.find((item) => item.stepId === "validate_cipherpay")?.complete,
    ).toBe(false);

    const validated = buildOnboardingChecklist(
      makeDetail({
        cipherpayConnections: [
          makeCipherPayConnection({
            status: "active",
          }),
        ],
      }),
    );

    expect(
      validated.find((item) => item.stepId === "validate_cipherpay")?.complete,
    ).toBe(true);
  });

  it("marks public checkout activation complete only for active tenants", () => {
    const draftChecklist = buildOnboardingChecklist(
      makeDetail({
        tenant: makeTenant({
          status: "draft",
          onboarding_status: "in_progress",
        }),
      }),
    );
    const activeChecklist = buildOnboardingChecklist(
      makeDetail({
        tenant: makeTenant({
          status: "active",
          onboarding_status: "completed",
        }),
      }),
    );

    expect(
      draftChecklist.find((item) => item.stepId === "activate_public_checkout")
        ?.complete,
    ).toBe(false);
    expect(
      activeChecklist.find((item) => item.stepId === "activate_public_checkout")
        ?.complete,
    ).toBe(true);
  });

  it("requires a future public event with at least one public ticket", () => {
    const calendar = makeCalendarConnection();
    const event = makeEventMirror({
      calendar_connection_id: calendar.calendar_connection_id,
      event_api_id: "event_live",
      start_at: "2026-04-24T18:00:00.000Z",
      zcash_enabled: true,
    });
    const hiddenTicket = makeTicketMirror({
      event_api_id: event.event_api_id,
      zcash_enabled: false,
    });
    const liveTicket = makeTicketMirror({
      event_api_id: event.event_api_id,
      zcash_enabled: true,
    });

    const incompleteChecklist = buildOnboardingChecklist(
      makeDetail({
        calendars: [calendar],
        events: [event],
        ticketsByEvent: new Map([[event.event_api_id, [hiddenTicket]]]),
      }),
    );

    expect(
      incompleteChecklist.find(
        (item) => item.stepId === "publish_event_and_ticket",
      )?.complete,
    ).toBe(false);

    const completeChecklist = buildOnboardingChecklist(
      makeDetail({
        calendars: [calendar],
        events: [event],
        ticketsByEvent: new Map([[event.event_api_id, [liveTicket]]]),
      }),
    );

    const publishStep = completeChecklist.find(
      (item) => item.stepId === "publish_event_and_ticket",
    );

    expect(publishStep?.complete).toBe(true);
    expect(publishStep?.description).toContain("1 public event live with 1 ticket available");
  });

  it("ignores past public events when deciding whether publishing is complete", () => {
    const calendar = makeCalendarConnection();
    const pastEvent = makeEventMirror({
      calendar_connection_id: calendar.calendar_connection_id,
      event_api_id: "event_past",
      start_at: "2026-01-01T00:00:00.000Z",
      zcash_enabled: true,
    });
    const ticket = makeTicketMirror({
      event_api_id: pastEvent.event_api_id,
      zcash_enabled: true,
    });

    const checklist = buildOnboardingChecklist(
      makeDetail({
        calendars: [calendar],
        events: [pastEvent],
        ticketsByEvent: new Map([[pastEvent.event_api_id, [ticket]]]),
      }),
    );

    expect(
      checklist.find((item) => item.stepId === "publish_event_and_ticket")
        ?.complete,
    ).toBe(false);
  });
});
