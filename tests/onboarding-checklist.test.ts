import { describe, expect, it } from "vitest";
import type { TenantOpsDetail } from "@/lib/tenancy/service";
import {
  buildEmbedSnippet,
  buildOnboardingChecklist,
} from "@/lib/tenant-self-serve";
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
    ]);
  });

  it("requires a connected and synced calendar for the Luma step", () => {
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
    ).toBe(false);
  });

  it("marks the Luma step complete once a calendar is connected and synced", () => {
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
      checklist.find((item) => item.stepId === "connect_luma_calendar")?.complete,
    ).toBe(true);
  });

  it("treats saving a CipherPay connection as the full checkout-account step", () => {
    const checklist = buildOnboardingChecklist(
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
      checklist.find((item) => item.stepId === "attach_cipherpay")?.complete,
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

  it("places publishing before public checkout activation", () => {
    const checklist = buildOnboardingChecklist(makeDetail());

    expect(checklist.map((item) => item.stepId)).toEqual([
      "draft_organizer_created",
      "connect_luma_calendar",
      "attach_cipherpay",
      "publish_event_and_ticket",
      "activate_public_checkout",
    ]);
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

  it("builds embed snippets with an automatic resize bridge", () => {
    const snippet = buildEmbedSnippet(
      "https://staging.zectix.com/c/demo-calendar?embed=1&po=https%3A%2F%2Fexample.com",
      'Demo "Calendar"',
      860,
    );

    expect(snippet).toContain(
      'src="https://staging.zectix.com/c/demo-calendar?embed=1&amp;po=https%3A%2F%2Fexample.com"',
    );
    expect(snippet).toContain('title="Demo &quot;Calendar&quot;"');
    expect(snippet).toContain(
      "const expectedOrigin = new URL(iframe.src).origin;",
    );
    expect(snippet).toContain(
      'if (!data || data.source !== "zectix-embed") return;',
    );
    expect(snippet).toContain(
      'iframe.style.height = Math.max(240, Math.ceil(data.height)) + "px";',
    );
    expect(snippet).toContain(
      'style="width:100%;min-height:240px;border:0;display:block;overflow:hidden;"',
    );
    expect(snippet).not.toContain('height:860px');
  });

  it("builds fixed-height embed snippets when dynamic height is turned off", () => {
    const snippet = buildEmbedSnippet(
      "https://staging.zectix.com/c/demo-calendar?embed=1",
      "Demo Calendar",
      920,
      { dynamicHeight: false },
    );

    expect(snippet).toContain(
      'style="width:100%;height:920px;border:0;display:block;overflow:hidden;"',
    );
  });
});
