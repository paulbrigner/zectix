import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeCalendarConnection, makeCheckoutSession, makeCipherPayConnection, makeEventMirror, makeTenant, makeTicketMirror } from "@/tests/test-helpers";

const mockFindLatestSessionForAttendee = vi.fn();
const mockPutSession = vi.fn();
const mockGetSessionByInvoiceId = vi.fn();
const mockUpdateSession = vi.fn();
const mockPutWebhookDelivery = vi.fn();
const mockUpdateWebhookDelivery = vi.fn();
const mockGetCipherPayConnectionByCalendar = vi.fn();
const mockGetPublicCalendar = vi.fn();
const mockGetPublicEventPageData = vi.fn();
const mockGetPublicTicket = vi.fn();
const mockResolveCipherPayClientForCalendar = vi.fn();
const mockResolveCipherPayWebhookSecretForCalendar = vi.fn();
const mockCreateCipherPayInvoice = vi.fn();
const mockEnsureRegistrationTaskForSession = vi.fn();
const mockProcessRegistrationTask = vi.fn();
const mockProcessDueRegistrationTasks = vi.fn();
const mockRetryRegistrationTaskForSession = vi.fn();
const mockHandleCalendarRefreshWebhook = vi.fn();

vi.mock("@/lib/app-state/state", () => ({
  findLatestSessionForAttendee: mockFindLatestSessionForAttendee,
  putSession: mockPutSession,
  getSessionByInvoiceId: mockGetSessionByInvoiceId,
  updateSession: mockUpdateSession,
  putWebhookDelivery: mockPutWebhookDelivery,
  updateWebhookDelivery: mockUpdateWebhookDelivery,
  getCipherPayConnectionByCalendar: mockGetCipherPayConnectionByCalendar,
}));

vi.mock("@/lib/public/public-calendars", () => ({
  getPublicCalendar: mockGetPublicCalendar,
  getPublicEventPageData: mockGetPublicEventPageData,
  getPublicTicket: mockGetPublicTicket,
}));

vi.mock("@/lib/tenancy/service", () => ({
  resolveCipherPayClientForCalendar: mockResolveCipherPayClientForCalendar,
  resolveCipherPayWebhookSecretForCalendar: mockResolveCipherPayWebhookSecretForCalendar,
}));

vi.mock("@/lib/cipherpay", () => ({
  createCipherPayInvoice: mockCreateCipherPayInvoice,
}));

vi.mock("@/lib/tasks/registration-tasks", () => ({
  ensureRegistrationTaskForSession: mockEnsureRegistrationTaskForSession,
  processRegistrationTask: mockProcessRegistrationTask,
  processDueRegistrationTasks: mockProcessDueRegistrationTasks,
  retryRegistrationTaskForSession: mockRetryRegistrationTaskForSession,
}));

vi.mock("@/lib/sync/luma-sync", () => ({
  handleCalendarRefreshWebhook: mockHandleCalendarRefreshWebhook,
}));

const {
  createCheckoutSession,
  processCipherPayWebhook,
  processLumaWebhook,
  resolveCipherPayWebhookContext,
} = await import("@/lib/app-state/service");

beforeEach(() => {
  mockFindLatestSessionForAttendee.mockReset();
  mockPutSession.mockReset();
  mockGetSessionByInvoiceId.mockReset();
  mockUpdateSession.mockReset();
  mockPutWebhookDelivery.mockReset();
  mockUpdateWebhookDelivery.mockReset();
  mockGetCipherPayConnectionByCalendar.mockReset();
  mockGetPublicCalendar.mockReset();
  mockGetPublicEventPageData.mockReset();
  mockGetPublicTicket.mockReset();
  mockResolveCipherPayClientForCalendar.mockReset();
  mockResolveCipherPayWebhookSecretForCalendar.mockReset();
  mockCreateCipherPayInvoice.mockReset();
  mockEnsureRegistrationTaskForSession.mockReset();
  mockProcessRegistrationTask.mockReset();
  mockProcessDueRegistrationTasks.mockReset();
  mockRetryRegistrationTaskForSession.mockReset();
  mockHandleCalendarRefreshWebhook.mockReset();

  mockGetPublicCalendar.mockResolvedValue({
    tenant: makeTenant(),
    calendar: makeCalendarConnection(),
    events: [makeEventMirror()],
  });
  mockGetPublicEventPageData.mockResolvedValue({
    tenant: makeTenant(),
    calendar: makeCalendarConnection(),
    event: makeEventMirror(),
    tickets: [makeTicketMirror()],
  });
  mockGetPublicTicket.mockResolvedValue(makeTicketMirror());
  mockResolveCipherPayClientForCalendar.mockResolvedValue({
    network: "mainnet",
    api_base_url: "https://api.cipherpay.app",
    checkout_base_url: "https://cipherpay.app",
    api_key: "cipherpay-api-key",
  });
  mockGetCipherPayConnectionByCalendar.mockResolvedValue(makeCipherPayConnection());
  mockHandleCalendarRefreshWebhook.mockResolvedValue({
    refreshed_at: "2026-03-24T12:05:00.000Z",
    event_count: 3,
  });
});

describe("checkout service", () => {
  it("reuses an active tenant-scoped checkout session", async () => {
    const existingSession = makeCheckoutSession();
    mockFindLatestSessionForAttendee.mockResolvedValueOnce(existingSession);

    const result = await createCheckoutSession({
      attendee_email: "jordan@example.com",
      attendee_name: "Jordan Lee",
      calendar_slug: "demo-calendar",
      event_api_id: "event_123",
      ticket_type_api_id: "ticket_123",
    });

    expect(mockCreateCipherPayInvoice).not.toHaveBeenCalled();
    expect(result.session).toBe(existingSession);
    expect(result.ticket.ticket_type_api_id).toBe("ticket_123");
  });

  it("creates and persists a fresh checkout session with service fee snapshots", async () => {
    mockFindLatestSessionForAttendee.mockResolvedValueOnce(null);
    mockCreateCipherPayInvoice.mockResolvedValueOnce({
      invoice: {
        invoice_id: "invoice_123",
        memo_code: "memo_123",
        payment_address: "u1testaddress",
        zcash_uri: "zcash:?address=u1testaddress&amount=0.01",
        price_zec: 0.01,
        expires_at: "2026-03-24T12:30:00.000Z",
        status: "pending",
        detected_txid: null,
        detected_at: null,
        confirmed_at: null,
        refunded_at: null,
      },
      checkout_url: "https://cipherpay.app/pay/invoice_123",
    });
    mockPutSession.mockImplementation(async (session) => session);

    const result = await createCheckoutSession({
      attendee_email: "jordan@example.com",
      attendee_name: "Jordan Lee",
      calendar_slug: "demo-calendar",
      event_api_id: "event_123",
      ticket_type_api_id: "ticket_123",
    });

    expect(mockCreateCipherPayInvoice).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        amount: 25,
        currency: "USD",
        product_name: "ZecTix Launch Party",
        size: "General Admission",
      }),
    );
    expect(mockPutSession).toHaveBeenCalledTimes(1);
    expect(result.session.cipherpay_invoice_id).toBe("invoice_123");
    expect(result.session.service_fee_bps_snapshot).toBe(450);
    expect(result.session.service_fee_amount_snapshot).toBe(1.13);
    expect(result.session.session_id).not.toBe("invoice_123");
  });
});

describe("webhook service", () => {
  it("resolves tenant-specific webhook secrets from the invoice lookup", async () => {
    mockGetSessionByInvoiceId.mockResolvedValueOnce(makeCheckoutSession());
    mockResolveCipherPayWebhookSecretForCalendar.mockResolvedValueOnce("tenant-secret");

    const result = await resolveCipherPayWebhookContext("invoice_123");

    expect(result.session?.session_id).toBe("session_123");
    expect(result.secret).toBe("tenant-secret");
  });

  it("records invalid webhooks without applying payment state", async () => {
    mockGetSessionByInvoiceId.mockResolvedValueOnce(makeCheckoutSession());
    mockPutWebhookDelivery.mockImplementation(async (delivery) => delivery);
    mockUpdateWebhookDelivery.mockImplementation(async (id, receivedAt, patch) => ({
      id,
      receivedAt,
      patch,
    }));

    const result = await processCipherPayWebhook({
      requestBody: { invoice_id: "invoice_123" },
      eventType: "invoice.detected",
      invoiceId: "invoice_123",
      signatureValid: false,
      validationError: "signature_mismatch",
      requestHeaders: {},
      txid: "txid_1",
    });

    expect(result).toBeNull();
    expect(mockPutWebhookDelivery).toHaveBeenCalledTimes(1);
    expect(mockUpdateSession).not.toHaveBeenCalled();
  });

  it("updates the session and immediately starts registration when payment is detected", async () => {
    const session = makeCheckoutSession({
      status: "pending",
    });
    const updatedSession = {
      ...session,
      status: "detected" as const,
      last_event_type: "invoice.detected",
      detected_at: "2026-03-24T12:00:00.000Z",
    };

    mockGetSessionByInvoiceId
      .mockResolvedValueOnce(session)
      .mockResolvedValueOnce(updatedSession);
    mockPutWebhookDelivery.mockImplementation(async (delivery) => delivery);
    mockUpdateWebhookDelivery.mockImplementation(async (id, receivedAt, patch) => ({
      id,
      receivedAt,
      patch,
    }));
    mockEnsureRegistrationTaskForSession.mockResolvedValueOnce({
      task_id: "task_123",
      session_id: session.session_id,
    });
    mockProcessRegistrationTask.mockResolvedValueOnce({
      task_id: "task_123",
      status: "in_progress",
    });
    mockUpdateSession.mockResolvedValueOnce(updatedSession);

    const result = await processCipherPayWebhook({
      requestBody: {
        invoice_id: "invoice_123",
        event: "invoice.detected",
        timestamp: "2026-03-24T12:00:00.000Z",
      },
      eventType: "invoice.detected",
      invoiceId: "invoice_123",
      signatureValid: true,
      validationError: null,
      requestHeaders: {},
      txid: "txid_1",
    });

    expect(mockUpdateSession).toHaveBeenCalledWith(
      "session_123",
      expect.objectContaining({
        status: "detected",
        last_txid: "txid_1",
      }),
    );
    expect(mockEnsureRegistrationTaskForSession).toHaveBeenCalledWith(updatedSession);
    expect(mockProcessRegistrationTask).toHaveBeenCalledWith({
      task_id: "task_123",
      session_id: session.session_id,
    });
    expect(result?.status).toBe("detected");
  });

  it("does not requeue registration work when a confirmed webhook arrives after the pass is already attached", async () => {
    const session = makeCheckoutSession({
      status: "detected",
      registration_status: "registered",
      luma_registration_json: {
        guest_lookup: {
          guest: {
            id: "guest_123",
          },
        },
      },
    });
    const updatedSession = {
      ...session,
      status: "confirmed" as const,
      last_event_type: "invoice.confirmed",
      confirmed_at: "2026-03-24T12:01:10.000Z",
    };

    mockGetSessionByInvoiceId.mockResolvedValueOnce(session);
    mockPutWebhookDelivery.mockImplementation(async (delivery) => delivery);
    mockUpdateWebhookDelivery.mockImplementation(async (id, receivedAt, patch) => ({
      id,
      receivedAt,
      patch,
    }));
    mockUpdateSession.mockResolvedValueOnce(updatedSession);

    const result = await processCipherPayWebhook({
      requestBody: {
        invoice_id: "invoice_123",
        event: "invoice.confirmed",
        timestamp: "2026-03-24T12:01:10.000Z",
      },
      eventType: "invoice.confirmed",
      invoiceId: "invoice_123",
      signatureValid: true,
      validationError: null,
      requestHeaders: {},
      txid: "txid_2",
    });

    expect(mockEnsureRegistrationTaskForSession).not.toHaveBeenCalled();
    expect(mockProcessRegistrationTask).not.toHaveBeenCalled();
    expect(result?.status).toBe("confirmed");
  });

  it("records and applies valid Luma event webhooks by refreshing mirrored events", async () => {
    mockPutWebhookDelivery.mockImplementation(async (delivery) => delivery);
    mockUpdateWebhookDelivery.mockImplementation(async (id, receivedAt, patch) => ({
      id,
      receivedAt,
      patch,
    }));

    const result = await processLumaWebhook({
      calendarConnectionId: "calendar_123",
      tenantId: "tenant_123",
      requestBody: {
        type: "event.updated",
        data: {
          id: "event_123",
        },
      },
      eventType: "event.updated",
      signatureValid: true,
      validationError: null,
      requestHeaders: {},
    });

    expect(mockPutWebhookDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "luma",
        calendar_connection_id: "calendar_123",
        tenant_id: "tenant_123",
        event_api_id: "event_123",
        event_type: "event.updated",
      }),
    );
    expect(mockHandleCalendarRefreshWebhook).toHaveBeenCalledWith("calendar_123");
    expect(result).toEqual(
      expect.objectContaining({
        applied: true,
        ignored: false,
        event_count: 3,
      }),
    );
  });

  it("records invalid Luma event webhooks without refreshing the calendar", async () => {
    mockPutWebhookDelivery.mockImplementation(async (delivery) => delivery);
    mockUpdateWebhookDelivery.mockImplementation(async (id, receivedAt, patch) => ({
      id,
      receivedAt,
      patch,
    }));

    const result = await processLumaWebhook({
      calendarConnectionId: "calendar_123",
      tenantId: "tenant_123",
      requestBody: {
        type: "event.created",
        data: {
          id: "event_123",
        },
      },
      eventType: "event.created",
      signatureValid: false,
      validationError: "signature_mismatch",
      requestHeaders: {},
    });

    expect(mockPutWebhookDelivery).toHaveBeenCalledTimes(1);
    expect(mockHandleCalendarRefreshWebhook).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        applied: false,
        ignored: true,
        reason: "signature_mismatch",
      }),
    );
  });
});
