import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CheckoutSession } from "@/lib/app-state/types";
import { makeCheckoutSession, makeRuntimeConfig } from "@/tests/test-helpers";

const mockGetRuntimeConfig = vi.fn();
const mockGetLumaEventById = vi.fn();
const mockListLumaTicketTypes = vi.fn();
const mockFindLatestSessionForAttendee = vi.fn();
const mockCreateCipherPayInvoice = vi.fn();
const mockPutSession = vi.fn();
const mockGetSession = vi.fn();
const mockUpsertSession = vi.fn();
const mockPutWebhookEvent = vi.fn();
const mockAddLumaGuest = vi.fn();
const mockGetLumaGuest = vi.fn();
const mockListSessionsNeedingRegistrationRecovery = vi.fn();

vi.mock("@/lib/app-state/state", () => ({
  findLatestSessionForAttendee: mockFindLatestSessionForAttendee,
  getRuntimeConfig: mockGetRuntimeConfig,
  getSession: mockGetSession,
  listSessionsNeedingRegistrationRecovery: mockListSessionsNeedingRegistrationRecovery,
  putSession: mockPutSession,
  putWebhookEvent: mockPutWebhookEvent,
  upsertSession: mockUpsertSession,
}));

vi.mock("@/lib/luma", () => ({
  addLumaGuest: mockAddLumaGuest,
  getLumaEventById: mockGetLumaEventById,
  getLumaGuest: mockGetLumaGuest,
  listLumaTicketTypes: mockListLumaTicketTypes,
}));

vi.mock("@/lib/cipherpay", () => ({
  createCipherPayInvoice: mockCreateCipherPayInvoice,
}));

const { createCheckoutSession, processCipherPayWebhook, syncAcceptedSessionRegistration } = await import(
  "@/lib/app-state/service"
);

beforeEach(() => {
  mockGetRuntimeConfig.mockReset();
  mockGetLumaEventById.mockReset();
  mockListLumaTicketTypes.mockReset();
  mockFindLatestSessionForAttendee.mockReset();
  mockCreateCipherPayInvoice.mockReset();
  mockPutSession.mockReset();
  mockGetSession.mockReset();
  mockUpsertSession.mockReset();
  mockPutWebhookEvent.mockReset();
  mockAddLumaGuest.mockReset();
  mockGetLumaGuest.mockReset();
  mockListSessionsNeedingRegistrationRecovery.mockReset();
  mockGetRuntimeConfig.mockResolvedValue(makeRuntimeConfig());
});

function makeFixedTicket(overrides: Record<string, unknown> = {}) {
  return {
    api_id: "ticket_123",
    name: "Standard",
    amount: 25,
    currency: "USD",
    active: true,
    description: "General admission",
    price_source: "amount",
    ...overrides,
  };
}

describe("checkout service", () => {
  it("throws when setup secrets are missing", async () => {
    mockGetRuntimeConfig.mockResolvedValueOnce(
      makeRuntimeConfig({
        api_key: "cipherpay-api-key",
        luma_api_key: null,
      }),
    );

    await expect(
      createCheckoutSession({
        attendee_email: "jordan@example.com",
        attendee_name: "Jordan Lee",
        event_api_id: "event_123",
        ticket_type_api_id: null,
      }),
    ).rejects.toThrow(/Luma API key/);

    mockGetRuntimeConfig.mockResolvedValueOnce(
      makeRuntimeConfig({
        api_key: null,
        luma_api_key: "luma-api-key",
      }),
    );
    mockGetLumaEventById.mockResolvedValueOnce({
      api_id: "event_123",
      name: "LumaZcash Event",
      start_at: "2026-03-24T12:00:00.000Z",
      end_at: null,
      timezone: null,
      description: null,
      cover_url: null,
      url: null,
      location_label: null,
      location_note: null,
    });
    mockListLumaTicketTypes.mockResolvedValueOnce([makeFixedTicket({ amount: null })]);

    await expect(
      createCheckoutSession({
        attendee_email: "jordan@example.com",
        attendee_name: "Jordan Lee",
        event_api_id: "event_123",
      ticket_type_api_id: null,
      }),
    ).rejects.toThrow(/CipherPay API key/);
  });

  it("throws when the selected ticket has no fixed price", async () => {
    mockGetRuntimeConfig.mockResolvedValueOnce(
      makeRuntimeConfig({
        api_key: "cipherpay-api-key",
        luma_api_key: "luma-api-key",
      }),
    );
    mockGetLumaEventById.mockResolvedValueOnce({
      api_id: "event_123",
      name: "LumaZcash Event",
      start_at: "2026-03-24T12:00:00.000Z",
      end_at: null,
      timezone: null,
      description: null,
      cover_url: null,
      url: null,
      location_label: null,
      location_note: null,
    });
    mockListLumaTicketTypes.mockResolvedValueOnce([makeFixedTicket({ amount: null })]);

    await expect(
      createCheckoutSession({
        attendee_email: "jordan@example.com",
        attendee_name: "Jordan Lee",
        event_api_id: "event_123",
        ticket_type_api_id: null,
      }),
    ).rejects.toThrow(/fixed price/);
  });

  it("reuses an active existing checkout session", async () => {
    const existingSession = makeCheckoutSession({
      session_id: "session_existing",
    });
    mockGetLumaEventById.mockResolvedValueOnce({
      api_id: "event_123",
      name: "LumaZcash Event",
      start_at: "2026-03-24T12:00:00.000Z",
      end_at: null,
      timezone: null,
      description: null,
      cover_url: null,
      url: null,
      location_label: null,
      location_note: null,
    });
    mockListLumaTicketTypes.mockResolvedValueOnce([makeFixedTicket()]);
    mockFindLatestSessionForAttendee.mockResolvedValueOnce(existingSession);

    const result = await createCheckoutSession({
      attendee_email: "jordan@example.com",
      attendee_name: "Jordan Lee",
      event_api_id: "event_123",
      ticket_type_api_id: "ticket_123",
    });

    expect(mockCreateCipherPayInvoice).not.toHaveBeenCalled();
    expect(result.session).toBe(existingSession);
    expect(result.invoice.invoice_id).toBe(existingSession.cipherpay_invoice_id);
  });

  it("creates and persists a fresh checkout session", async () => {
    const invoice = {
      invoice_id: "invoice_123",
      memo_code: "memo_123",
      payment_address: "u1testaddress",
      zcash_uri: "zcash:?address=u1testaddress&amount=25",
      price_zec: 0.1,
      expires_at: "2026-03-24T12:30:00.000Z",
      checkout_url: "https://cipherpay.app/checkout/invoice_123",
      status: "pending" as const,
      detected_txid: null,
      detected_at: null,
      confirmed_at: null,
      refunded_at: null,
    };
    const event = {
      api_id: "event_123",
      name: "LumaZcash Event",
      start_at: "2026-03-24T12:00:00.000Z",
      end_at: null,
      timezone: null,
      description: null,
      cover_url: null,
      url: null,
      location_label: null,
      location_note: null,
    };

    mockGetLumaEventById.mockResolvedValueOnce(event);
    mockListLumaTicketTypes.mockResolvedValueOnce([makeFixedTicket()]);
    mockFindLatestSessionForAttendee.mockResolvedValueOnce(null);
    mockCreateCipherPayInvoice.mockResolvedValueOnce({ invoice, checkout_url: invoice.checkout_url });
    mockPutSession.mockImplementation(async (session: CheckoutSession) => session);

    const result = await createCheckoutSession({
      attendee_email: "jordan@example.com",
      attendee_name: "Jordan Lee",
      event_api_id: "event_123",
      ticket_type_api_id: "ticket_123",
    });

    expect(mockCreateCipherPayInvoice).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        amount: 25,
        currency: "USD",
        product_name: "LumaZcash Event",
        size: "Standard",
      }),
    );
    expect(mockPutSession).toHaveBeenCalledTimes(1);
    expect(result.session.cipherpay_invoice_id).toBe("invoice_123");
    expect(result.session.attendee_email).toBe("jordan@example.com");
    expect(result.invoice.checkout_url).toBe(invoice.checkout_url);
  });
});

describe("webhook service", () => {
  it("records invalid webhooks without applying them", async () => {
    mockPutWebhookEvent.mockResolvedValueOnce({
      event_id: "event_1",
      cipherpay_invoice_id: "invoice_123",
      event_type: "invoice.detected",
      txid: "txid_1",
      signature_valid: false,
      validation_error: "signature_mismatch",
      timestamp_header: "1711281600",
      request_body_json: { invoice_id: "invoice_123" },
      request_headers_json: { "x-cipherpay-signature": "bad" },
      received_at: "2026-03-24T12:00:00.000Z",
    });

    const result = await processCipherPayWebhook({
      requestBody: { invoice_id: "invoice_123" },
      eventType: "invoice.detected",
      invoiceId: "invoice_123",
      signatureValid: false,
      validationError: "signature_mismatch",
      requestHeaders: {
        "x-cipherpay-signature": "bad",
      },
      timestampHeader: "1711281600",
      txid: "txid_1",
    });

    expect(mockPutWebhookEvent).toHaveBeenCalledTimes(1);
    expect(result).toBeNull();
    expect(mockGetSession).not.toHaveBeenCalled();
  });

  it("keeps registration pending when Luma guest lookup is still missing", async () => {
    const session = makeCheckoutSession({
      session_id: "session_confirmed",
      cipherpay_invoice_id: "invoice_confirmed",
      status: "confirmed",
      registration_status: "pending",
    });

    mockPutWebhookEvent.mockResolvedValueOnce({
      event_id: "event_1",
      cipherpay_invoice_id: "invoice_confirmed",
      event_type: "confirmed",
      txid: "txid_1",
      signature_valid: true,
      validation_error: null,
      timestamp_header: "1711281600",
      request_body_json: { invoice_id: "invoice_confirmed", event: "confirmed" },
      request_headers_json: {},
      received_at: "2026-03-24T12:00:00.000Z",
    });
    mockGetSession.mockResolvedValueOnce(session);
    mockUpsertSession
      .mockResolvedValueOnce({
        ...session,
        status: "confirmed",
        last_event_type: "confirmed",
        confirmed_at: "2026-03-24T12:00:00.000Z",
      })
      .mockResolvedValueOnce({
        ...session,
        status: "confirmed",
        registration_status: "pending",
        registration_error:
          "Payment accepted. Waiting for Luma to attach the attendee pass.",
        registration_failure_code: "guest_lookup_pending",
        registration_attempt_count: 1,
        registration_last_attempt_at: "2026-03-24T12:00:00.000Z",
        registration_next_retry_at: "2026-03-24T12:00:30.000Z",
        luma_registration_json: {},
        registered_at: null,
      });
    mockAddLumaGuest.mockResolvedValueOnce({});
    mockGetLumaGuest.mockResolvedValueOnce(null);

    const result = await processCipherPayWebhook({
      requestBody: { invoice_id: "invoice_confirmed", event: "confirmed" },
      eventType: "confirmed",
      invoiceId: "invoice_confirmed",
      signatureValid: true,
      validationError: null,
      requestHeaders: {},
      timestampHeader: "1711281600",
      txid: "txid_1",
    });

    expect(mockAddLumaGuest).toHaveBeenCalledTimes(1);
    expect(mockGetLumaGuest).toHaveBeenCalledTimes(1);
    expect(result?.registration_status).toBe("pending");
    expect(result?.registration_failure_code).toBe("guest_lookup_pending");
    expect(result?.registered_at).toBeNull();
  });

  it("repairs accepted sessions once the Luma guest record becomes available", async () => {
    const session = makeCheckoutSession({
      session_id: "session_registered",
      status: "confirmed",
      registration_status: "registered",
      registration_attempt_count: 1,
      registration_last_attempt_at: "2026-03-24T12:00:00.000Z",
      luma_registration_json: {},
    });

    mockGetLumaGuest.mockResolvedValueOnce({
      guest: {
        id: "gst_123",
        registered_at: "2026-03-24T12:01:00.000Z",
        check_in_qr_code: "https://luma.test/qr",
      },
    });
    mockUpsertSession.mockResolvedValueOnce({
      ...session,
      registration_status: "registered",
      registration_error: null,
      registration_failure_code: null,
      registration_next_retry_at: null,
      luma_registration_json: {
        guest_lookup: {
          guest: {
            id: "gst_123",
            registered_at: "2026-03-24T12:01:00.000Z",
            check_in_qr_code: "https://luma.test/qr",
          },
        },
      },
      registered_at: "2026-03-24T12:01:00.000Z",
    });

    const result = await syncAcceptedSessionRegistration(session, makeRuntimeConfig());

    expect(mockGetLumaGuest).toHaveBeenCalledTimes(1);
    expect(mockAddLumaGuest).not.toHaveBeenCalled();
    expect(result.registration_status).toBe("registered");
    expect(result.luma_registration_json).toEqual({
      guest_lookup: {
        guest: {
          id: "gst_123",
          registered_at: "2026-03-24T12:01:00.000Z",
          check_in_qr_code: "https://luma.test/qr",
        },
      },
    });
  });

  it("fails accepted sessions after repeated silent guest-creation no-ops", async () => {
    const session = makeCheckoutSession({
      session_id: "session_stuck",
      status: "confirmed",
      registration_status: "pending",
      registration_attempt_count: 2,
      attendee_email: "PaulBrigner+T16@gmail.com",
      registration_next_retry_at: "2026-03-24T11:59:00.000Z",
    });

    mockAddLumaGuest.mockResolvedValueOnce({});
    mockGetLumaGuest.mockResolvedValueOnce(null);
    mockUpsertSession.mockResolvedValueOnce({
      ...session,
      registration_status: "failed",
      registration_error:
        "Payment accepted, but Luma did not create the attendee record yet. Please retry from Operations or verify the attendee email in Luma.",
      registration_failure_code: "guest_creation_unconfirmed",
      registration_attempt_count: 3,
      registration_last_attempt_at: "2026-03-24T12:00:00.000Z",
      registration_next_retry_at: "2026-03-24T12:20:00.000Z",
      luma_registration_json: {},
      registered_at: null,
    });

    const result = await syncAcceptedSessionRegistration(session, makeRuntimeConfig());

    expect(mockAddLumaGuest).toHaveBeenCalledWith(
      expect.objectContaining({
        attendeeEmail: "paulbrigner+t16@gmail.com",
      }),
    );
    expect(result.registration_status).toBe("failed");
    expect(result.registration_failure_code).toBe("guest_creation_unconfirmed");
    expect(result.registration_error).toMatch(/did not create the attendee record/i);
  });
});
