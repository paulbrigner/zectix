import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  makeCalendarConnection,
  makeCipherPayConnection,
  makeEventMirror,
  makeTenant,
  makeTicketMirror,
} from "@/tests/test-helpers";

const mockGetCalendarConnection = vi.fn();
const mockGetCalendarConnectionBySlug = vi.fn();
const mockGetCipherPayConnection = vi.fn();
const mockGetCipherPayConnectionByCalendar = vi.fn();
const mockGetEventMirror = vi.fn();
const mockGetTenant = vi.fn();
const mockGetTenantBySlug = vi.fn();
const mockGetTicketMirror = vi.fn();
const mockListCalendarConnectionsByTenant = vi.fn();
const mockListCipherPayConnectionsByTenant = vi.fn();
const mockListEventMirrorsByCalendar = vi.fn();
const mockListRegistrationTasksByTenant = vi.fn();
const mockListSessionsByTenant = vi.fn();
const mockListTenantsByContactEmail = vi.fn();
const mockListTicketMirrorsByEvent = vi.fn();
const mockListWebhookDeliveriesByTenant = vi.fn();
const mockPutCalendarConnection = vi.fn();
const mockPutCipherPayConnection = vi.fn();
const mockPutEventMirror = vi.fn();
const mockPutTenant = vi.fn();
const mockPutTicketMirror = vi.fn();

const mockSetSecret = vi.fn();
const mockGetSecret = vi.fn();
const mockDeleteLumaWebhook = vi.fn();
const mockListLumaEvents = vi.fn();
const mockEnsureCalendarConnectionWebhookSubscription = vi.fn();
const mockSyncCalendarConnection = vi.fn();
const mockValidateCalendarConnection = vi.fn();
const mockGetTenantBillingSnapshot = vi.fn();

vi.mock("@/lib/app-state/state", () => ({
  getCalendarConnection: mockGetCalendarConnection,
  getCalendarConnectionBySlug: mockGetCalendarConnectionBySlug,
  getCipherPayConnection: mockGetCipherPayConnection,
  getCipherPayConnectionByCalendar: mockGetCipherPayConnectionByCalendar,
  getEventMirror: mockGetEventMirror,
  getTenant: mockGetTenant,
  getTenantBySlug: mockGetTenantBySlug,
  getTicketMirror: mockGetTicketMirror,
  listCalendarConnectionsByTenant: mockListCalendarConnectionsByTenant,
  listCipherPayConnectionsByTenant: mockListCipherPayConnectionsByTenant,
  listEventMirrorsByCalendar: mockListEventMirrorsByCalendar,
  listRegistrationTasksByTenant: mockListRegistrationTasksByTenant,
  listSessionsByTenant: mockListSessionsByTenant,
  listTenantsByContactEmail: mockListTenantsByContactEmail,
  listTicketMirrorsByEvent: mockListTicketMirrorsByEvent,
  listWebhookDeliveriesByTenant: mockListWebhookDeliveriesByTenant,
  putCalendarConnection: mockPutCalendarConnection,
  putCipherPayConnection: mockPutCipherPayConnection,
  putEventMirror: mockPutEventMirror,
  putTenant: mockPutTenant,
  putTicketMirror: mockPutTicketMirror,
}));

vi.mock("@/lib/secrets", () => ({
  getSecretStore: () => ({
    setSecret: mockSetSecret,
    getSecret: mockGetSecret,
  }),
}));

vi.mock("@/lib/sync/luma-sync", () => ({
  ensureCalendarConnectionWebhookSubscription:
    mockEnsureCalendarConnectionWebhookSubscription,
  syncCalendarConnection: mockSyncCalendarConnection,
  validateCalendarConnection: mockValidateCalendarConnection,
}));

vi.mock("@/lib/luma", () => ({
  deleteLumaWebhook: mockDeleteLumaWebhook,
  listLumaEvents: mockListLumaEvents,
}));

vi.mock("@/lib/billing/usage-ledger", () => ({
  getTenantBillingSnapshot: mockGetTenantBillingSnapshot,
}));

const {
  buildFocusedEventSyncReview,
  createCalendarConnection,
  createCipherPayConnection,
  createTenant,
  disableCalendarConnection,
  getTenantOpsDetail,
  getTenantSelfServeDetailBySlug,
  listSelfServeTenantsForEmail,
  syncCalendarEventForOps,
  updateCalendarEmbedSettings,
  updateCalendarConnectionLumaKey,
  validateCipherPayConnection,
} = await import(
  "@/lib/tenancy/service"
);

beforeEach(() => {
  vi.unstubAllEnvs();
  mockGetCalendarConnection.mockReset();
  mockGetCalendarConnectionBySlug.mockReset();
  mockGetCipherPayConnection.mockReset();
  mockGetCipherPayConnectionByCalendar.mockReset();
  mockGetEventMirror.mockReset();
  mockGetTenant.mockReset();
  mockGetTenantBySlug.mockReset();
  mockGetTicketMirror.mockReset();
  mockListCalendarConnectionsByTenant.mockReset();
  mockListCipherPayConnectionsByTenant.mockReset();
  mockListEventMirrorsByCalendar.mockReset();
  mockListRegistrationTasksByTenant.mockReset();
  mockListSessionsByTenant.mockReset();
  mockListTenantsByContactEmail.mockReset();
  mockListTicketMirrorsByEvent.mockReset();
  mockListWebhookDeliveriesByTenant.mockReset();
  mockPutCalendarConnection.mockReset();
  mockPutCipherPayConnection.mockReset();
  mockPutEventMirror.mockReset();
  mockPutTenant.mockReset();
  mockPutTicketMirror.mockReset();
  mockSetSecret.mockReset();
  mockGetSecret.mockReset();
  mockDeleteLumaWebhook.mockReset();
  mockListLumaEvents.mockReset();
  mockEnsureCalendarConnectionWebhookSubscription.mockReset();
  mockSyncCalendarConnection.mockReset();
  mockValidateCalendarConnection.mockReset();
  mockGetTenantBillingSnapshot.mockReset();

  mockPutCalendarConnection.mockImplementation(async (connection) => connection);
  mockPutCipherPayConnection.mockImplementation(async (connection) => connection);
  mockPutTenant.mockImplementation(async (tenant) => tenant);
  mockGetSecret.mockResolvedValue("resolved-secret");
  mockListLumaEvents.mockResolvedValue([]);
  mockListSessionsByTenant.mockResolvedValue([]);
  mockListCalendarConnectionsByTenant.mockResolvedValue([]);
  mockListCipherPayConnectionsByTenant.mockResolvedValue([]);
  mockListTenantsByContactEmail.mockResolvedValue([]);
  mockListWebhookDeliveriesByTenant.mockResolvedValue([]);
  mockListRegistrationTasksByTenant.mockResolvedValue([]);
  mockListEventMirrorsByCalendar.mockResolvedValue([]);
  mockListTicketMirrorsByEvent.mockResolvedValue([]);
  mockGetTenantBillingSnapshot.mockResolvedValue({
    tenant: makeTenant(),
    current_cycle: null,
    cycles: [],
    adjustments_by_cycle: new Map(),
  });
});

describe("buildFocusedEventSyncReview", () => {
  it("treats a new upstream event as an import with added ticket tiers", () => {
    const afterEvent = makeEventMirror({
      event_api_id: "event_imported",
      name: "Imported Event",
      zcash_enabled: false,
    });
    const afterTickets = [
      makeTicketMirror({
        event_api_id: "event_imported",
        ticket_type_api_id: "ticket_new_1",
      }),
      makeTicketMirror({
        event_api_id: "event_imported",
        ticket_type_api_id: "ticket_new_2",
      }),
    ];

    const review = buildFocusedEventSyncReview({
      tenant_id: "tenant_123",
      calendar_connection_id: "calendar_123",
      event_api_id: "event_imported",
      event_name: "Imported Event",
      focus: "upstream",
      before: { event: null, tickets: [] },
      after: { event: afterEvent, tickets: afterTickets },
      happened_at: "2026-03-27T12:00:00.000Z",
    });

    expect(review.outcome).toBe("imported");
    expect(review.tickets_added).toBe(2);
    expect(review.tickets_removed).toBe(0);
    expect(review.mirrored_ticket_count).toBe(2);
  });

  it("treats an event hidden by the latest sync as removed from the current feed", () => {
    const beforeEvent = makeEventMirror({
      event_api_id: "event_hidden",
      name: "Hidden Event",
      sync_status: "active",
    });
    const afterEvent = makeEventMirror({
      event_api_id: "event_hidden",
      name: "Hidden Event",
      sync_status: "hidden",
      zcash_enabled: false,
    });

    const review = buildFocusedEventSyncReview({
      tenant_id: "tenant_123",
      calendar_connection_id: "calendar_123",
      event_api_id: "event_hidden",
      event_name: "Hidden Event",
      focus: "mirrored",
      before: { event: beforeEvent, tickets: [] },
      after: { event: afterEvent, tickets: [] },
      happened_at: "2026-03-27T12:00:00.000Z",
    });

    expect(review.outcome).toBe("hidden");
    expect(review.sync_status).toBe("hidden");
    expect(review.public_checkout_enabled).toBe(false);
  });
});

describe("createCalendarConnection", () => {
  it("starts with managed webhook fields unset until validate and sync runs", async () => {
    mockSetSecret.mockResolvedValue("secret://luma-api");

    const result = await createCalendarConnection({
      tenant_id: "tenant_123",
      display_name: "Demo Calendar",
      slug: "",
      luma_api_key: "luma_api_key",
    });

    expect(mockSetSecret).toHaveBeenCalledTimes(1);
    expect(mockSetSecret).toHaveBeenCalledWith(null, "luma_api_key");
    expect(result.luma_api_secret_ref).toBe("secret://luma-api");
    expect(result.luma_webhook_id).toBeNull();
    expect(result.luma_webhook_secret_ref).toBeNull();
    expect(result.luma_webhook_token_ref).toBeNull();
  });
});

describe("createTenant", () => {
  it("can start a self-serve tenant in onboarding mode", async () => {
    mockGetTenantBySlug.mockResolvedValue(null);

    const result = await createTenant({
      name: "Self Serve Org",
      contact_email: "owner@example.com",
      onboarding_source: "self_serve",
      onboarding_status: "in_progress",
    });

    expect(result.status).toBe("draft");
    expect(result.onboarding_source).toBe("self_serve");
    expect(result.onboarding_status).toBe("in_progress");
    expect(result.onboarding_started_at).not.toBeNull();
    expect(result.onboarding_completed_at).toBeNull();
  });

  it("uses env-backed billing defaults when commercial fields are omitted", async () => {
    vi.stubEnv("TENANT_DEFAULT_SERVICE_FEE_BPS", "33");
    vi.stubEnv("TENANT_DEFAULT_SETTLEMENT_THRESHOLD_ZATOSHIS", "1000000");
    mockGetTenantBySlug.mockResolvedValue(null);

    const result = await createTenant({
      name: "Env Default Org",
      contact_email: "owner@example.com",
    });

    expect(result.service_fee_bps).toBe(33);
    expect(result.settlement_threshold_zatoshis).toBe(1_000_000);
  });
});

describe("updateCalendarConnectionLumaKey", () => {
  it("reuses the stored secret ref and clears managed validation state", async () => {
    const existingConnection = makeCalendarConnection({
      luma_api_secret_ref: "secret://luma-existing",
      luma_webhook_secret_ref: "secret://luma-webhook-existing",
      luma_webhook_id: "whk_existing",
      last_validated_at: "2026-03-24T12:00:00.000Z",
      last_synced_at: "2026-03-24T12:30:00.000Z",
      last_sync_error: "old sync error",
    });

    mockGetCalendarConnection.mockResolvedValue(existingConnection);
    mockSetSecret.mockResolvedValue("secret://luma-existing");

    const result = await updateCalendarConnectionLumaKey(
      existingConnection.calendar_connection_id,
      "new_luma_api_key",
    );

    expect(mockSetSecret).toHaveBeenCalledTimes(1);
    expect(mockSetSecret).toHaveBeenCalledWith(
      "secret://luma-existing",
      "new_luma_api_key",
    );
    expect(result.luma_api_secret_ref).toBe("secret://luma-existing");
    expect(result.luma_webhook_secret_ref).toBeNull();
    expect(result.luma_webhook_token_ref).toBeNull();
    expect(result.luma_webhook_id).toBeNull();
    expect(result.last_validated_at).toBeNull();
    expect(result.last_synced_at).toBe("2026-03-24T12:30:00.000Z");
    expect(result.last_sync_error).toBeNull();
  });

  it("throws when the calendar connection cannot be found", async () => {
    mockGetCalendarConnection.mockResolvedValue(null);

    await expect(
      updateCalendarConnectionLumaKey("missing_calendar", "new_luma_api_key"),
    ).rejects.toThrow("Calendar connection missing_calendar was not found.");
  });
});

describe("disableCalendarConnection", () => {
  it("marks the connection disabled and clears managed webhook state", async () => {
    const existingConnection = makeCalendarConnection({
      status: "active",
      luma_api_secret_ref: "secret://luma-existing",
      luma_webhook_secret_ref: "secret://luma-webhook-existing",
      luma_webhook_token_ref: "secret://luma-webhook-token-existing",
      luma_webhook_id: "whk_existing",
      last_sync_error: "old sync error",
    });

    mockGetCalendarConnection.mockResolvedValue(existingConnection);
    mockGetSecret.mockResolvedValue("resolved-luma-api-key");
    mockDeleteLumaWebhook.mockResolvedValue(undefined);

    const result = await disableCalendarConnection(
      existingConnection.calendar_connection_id,
    );

    expect(mockDeleteLumaWebhook).toHaveBeenCalledWith({
      apiKey: "resolved-luma-api-key",
      id: "whk_existing",
    });
    expect(result.status).toBe("disabled");
    expect(result.luma_webhook_id).toBeNull();
    expect(result.luma_webhook_secret_ref).toBeNull();
    expect(result.luma_webhook_token_ref).toBeNull();
    expect(result.last_sync_error).toBeNull();
  });

  it("still disables locally if the upstream webhook is already gone", async () => {
    const existingConnection = makeCalendarConnection({
      luma_api_secret_ref: "secret://luma-existing",
      luma_webhook_id: "whk_missing",
      luma_webhook_secret_ref: "secret://luma-webhook-existing",
      luma_webhook_token_ref: "secret://luma-webhook-token-existing",
    });

    mockGetCalendarConnection.mockResolvedValue(existingConnection);
    mockGetSecret.mockResolvedValue("resolved-luma-api-key");
    mockDeleteLumaWebhook.mockRejectedValue(new Error("Webhook not found"));

    const result = await disableCalendarConnection(
      existingConnection.calendar_connection_id,
    );

    expect(result.status).toBe("disabled");
    expect(result.luma_webhook_id).toBeNull();
    expect(result.luma_webhook_secret_ref).toBeNull();
    expect(result.luma_webhook_token_ref).toBeNull();
  });
});

describe("createCipherPayConnection", () => {
  it("updates the existing calendar connection instead of creating a duplicate", async () => {
    const existingConnection = makeCipherPayConnection({
      cipherpay_connection_id: "cp_existing",
      cipherpay_api_secret_ref: "secret://api-existing",
      cipherpay_webhook_secret_ref: "secret://webhook-existing",
      status: "active",
      last_validated_at: "2026-03-24T12:00:00.000Z",
      updated_at: "2026-03-24T12:00:00.000Z",
    });

    mockGetCipherPayConnectionByCalendar.mockResolvedValue(existingConnection);
    mockSetSecret
      .mockResolvedValueOnce("secret://api-existing")
      .mockResolvedValueOnce("secret://webhook-existing");

    const result = await createCipherPayConnection({
      tenant_id: existingConnection.tenant_id,
      calendar_connection_id: existingConnection.calendar_connection_id,
      network: "testnet",
      api_base_url: "",
      checkout_base_url: "",
      cipherpay_api_key: "cpay_sk_new",
      cipherpay_webhook_secret: "whsec_new",
    });

    expect(mockSetSecret).toHaveBeenNthCalledWith(
      1,
      "secret://api-existing",
      "cpay_sk_new",
    );
    expect(mockSetSecret).toHaveBeenNthCalledWith(
      2,
      "secret://webhook-existing",
      "whsec_new",
    );
    expect(result.cipherpay_connection_id).toBe("cp_existing");
    expect(result.network).toBe("testnet");
    expect(result.status).toBe("pending_validation");
    expect(result.last_validated_at).toBeNull();
    expect(result.cipherpay_api_secret_ref).toBe("secret://api-existing");
    expect(result.cipherpay_webhook_secret_ref).toBe("secret://webhook-existing");
  });
});

describe("validateCipherPayConnection", () => {
  it("does not reattach a historical connection when marking it validated", async () => {
    const existingConnection = makeCipherPayConnection({
      cipherpay_connection_id: "cp_existing",
      status: "pending_validation",
    });

    mockGetCipherPayConnection.mockResolvedValue(existingConnection);

    await validateCipherPayConnection(existingConnection.cipherpay_connection_id);

    expect(mockPutCipherPayConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        cipherpay_connection_id: "cp_existing",
        status: "active",
      }),
      { attachToCalendar: false },
    );
  });
});

describe("updateCalendarEmbedSettings", () => {
  it("stores normalized origins and embed theme settings", async () => {
    const existingConnection = makeCalendarConnection();
    mockGetCalendarConnection.mockResolvedValue(existingConnection);

    const result = await updateCalendarEmbedSettings({
      calendar_connection_id: existingConnection.calendar_connection_id,
      embed_enabled: true,
      embed_allowed_origins:
        "https://events.example.com\nhttps://app.example.com/page",
      embed_default_height_px: "920",
      embed_show_branding: false,
      embed_theme: {
        accent_color: "#F7931A",
        background_color: "#FAFAF9",
        surface_color: "#FFFFFF",
        text_color: "#131B2D",
        radius_px: "26",
      },
    });

    expect(result.embed_enabled).toBe(true);
    expect(result.embed_allowed_origins).toEqual([
      "https://events.example.com",
      "https://app.example.com",
    ]);
    expect(result.embed_default_height_px).toBe(920);
    expect(result.embed_show_branding).toBe(false);
    expect(result.embed_theme).toEqual({
      accent_color: "#f7931a",
      background_color: "#fafaf9",
      surface_color: "#ffffff",
      text_color: "#131b2d",
      radius_px: 26,
    });
  });
});

describe("getTenantOpsDetail", () => {
  it("reports which CipherPay connection is currently attached to each calendar", async () => {
    const tenant = makeTenant();
    const calendar = makeCalendarConnection();
    const currentConnection = makeCipherPayConnection({
      cipherpay_connection_id: "cp_current",
      calendar_connection_id: calendar.calendar_connection_id,
      updated_at: "2026-03-24T13:00:00.000Z",
    });
    const historicalConnection = makeCipherPayConnection({
      cipherpay_connection_id: "cp_old",
      calendar_connection_id: calendar.calendar_connection_id,
      updated_at: "2026-03-24T11:00:00.000Z",
    });

    mockGetTenant.mockResolvedValue(tenant);
    mockListCalendarConnectionsByTenant.mockResolvedValue([calendar]);
    mockListCipherPayConnectionsByTenant.mockResolvedValue([
      currentConnection,
      historicalConnection,
    ]);
    mockGetCipherPayConnectionByCalendar.mockResolvedValue(currentConnection);

    const detail = await getTenantOpsDetail(tenant.tenant_id);

    expect(
      detail?.active_cipherpay_connections_by_calendar.get(
        calendar.calendar_connection_id,
      )?.cipherpay_connection_id,
    ).toBe("cp_current");
    expect(
      detail?.upstream_luma_events_by_calendar.get(
        calendar.calendar_connection_id,
      ),
    ).toEqual({
      events: [],
      error: null,
    });
  });
});

describe("listSelfServeTenantsForEmail", () => {
  it("filters archived tenants out of the self-serve list", async () => {
    mockListTenantsByContactEmail.mockResolvedValue([
      makeTenant({ tenant_id: "tenant_active", status: "active" }),
      makeTenant({ tenant_id: "tenant_archived", status: "archived" }),
    ]);

    const result = await listSelfServeTenantsForEmail("contact@example.com");

    expect(mockListTenantsByContactEmail).toHaveBeenCalledWith("contact@example.com");
    expect(result.map((tenant) => tenant.tenant_id)).toEqual(["tenant_active"]);
  });
});

describe("getTenantSelfServeDetailBySlug", () => {
  it("returns null when the signed-in email does not match the tenant contact", async () => {
    mockGetTenantBySlug.mockResolvedValue(
      makeTenant({
        tenant_id: "tenant_123",
        slug: "demo-tenant",
        contact_email: "owner@example.com",
      }),
    );

    const result = await getTenantSelfServeDetailBySlug(
      "demo-tenant",
      "other@example.com",
    );

    expect(result).toBeNull();
  });
});

describe("syncCalendarEventForOps", () => {
  it("runs the existing calendar refresh and returns a focused event diff", async () => {
    const calendar = makeCalendarConnection();
    const beforeEvent = makeEventMirror({
      event_api_id: "event_focus",
      name: "Event Before",
      zcash_enabled: false,
    });
    const afterEvent = makeEventMirror({
      event_api_id: "event_focus",
      name: "Event After",
      zcash_enabled: true,
      last_synced_at: "2026-03-27T12:30:00.000Z",
    });
    const beforeTickets = [
      makeTicketMirror({
        event_api_id: "event_focus",
        ticket_type_api_id: "ticket_old",
        zcash_enabled: false,
      }),
    ];
    const afterTickets = [
      makeTicketMirror({
        event_api_id: "event_focus",
        ticket_type_api_id: "ticket_old",
        zcash_enabled: false,
      }),
      makeTicketMirror({
        event_api_id: "event_focus",
        ticket_type_api_id: "ticket_new",
        zcash_enabled: true,
      }),
    ];

    mockGetCalendarConnection.mockResolvedValue(calendar);
    mockGetEventMirror.mockResolvedValue(beforeEvent);
    mockListTicketMirrorsByEvent
      .mockResolvedValueOnce(beforeTickets)
      .mockResolvedValueOnce(afterTickets);
    mockSyncCalendarConnection.mockResolvedValue({
      connection: {
        ...calendar,
        last_synced_at: "2026-03-27T12:30:00.000Z",
      },
      events: [afterEvent],
    });

    const result = await syncCalendarEventForOps({
      calendar_connection_id: calendar.calendar_connection_id,
      event_api_id: "event_focus",
      event_name: "Event Before",
      focus: "mirrored",
    });

    expect(mockSyncCalendarConnection).toHaveBeenCalledWith(
      calendar.calendar_connection_id,
    );
    expect(result.review.outcome).toBe("updated");
    expect(result.review.event_name).toBe("Event After");
    expect(result.review.tickets_added).toBe(1);
    expect(result.review.enabled_ticket_count).toBe(1);
    expect(result.review.public_checkout_enabled).toBe(true);
  });
});
