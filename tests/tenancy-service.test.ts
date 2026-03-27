import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  makeCalendarConnection,
  makeCipherPayConnection,
  makeTenant,
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
const mockListTicketMirrorsByEvent = vi.fn();
const mockListWebhookDeliveriesByTenant = vi.fn();
const mockPutCalendarConnection = vi.fn();
const mockPutCipherPayConnection = vi.fn();
const mockPutEventMirror = vi.fn();
const mockPutTenant = vi.fn();
const mockPutTicketMirror = vi.fn();

const mockSetSecret = vi.fn();
const mockGetSecret = vi.fn();
const mockListLumaEvents = vi.fn();

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
  ensureCalendarConnectionWebhookSubscription: vi.fn(),
  syncCalendarConnection: vi.fn(),
  validateCalendarConnection: vi.fn(),
}));

vi.mock("@/lib/luma", () => ({
  listLumaEvents: mockListLumaEvents,
}));

const {
  createCalendarConnection,
  createCipherPayConnection,
  getTenantOpsDetail,
  validateCipherPayConnection,
} = await import(
  "@/lib/tenancy/service"
);

beforeEach(() => {
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
  mockListTicketMirrorsByEvent.mockReset();
  mockListWebhookDeliveriesByTenant.mockReset();
  mockPutCalendarConnection.mockReset();
  mockPutCipherPayConnection.mockReset();
  mockPutEventMirror.mockReset();
  mockPutTenant.mockReset();
  mockPutTicketMirror.mockReset();
  mockSetSecret.mockReset();
  mockGetSecret.mockReset();
  mockListLumaEvents.mockReset();

  mockPutCalendarConnection.mockImplementation(async (connection) => connection);
  mockPutCipherPayConnection.mockImplementation(async (connection) => connection);
  mockGetSecret.mockResolvedValue("resolved-secret");
  mockListLumaEvents.mockResolvedValue([]);
  mockListSessionsByTenant.mockResolvedValue([]);
  mockListWebhookDeliveriesByTenant.mockResolvedValue([]);
  mockListRegistrationTasksByTenant.mockResolvedValue([]);
  mockListEventMirrorsByCalendar.mockResolvedValue([]);
  mockListTicketMirrorsByEvent.mockResolvedValue([]);
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
