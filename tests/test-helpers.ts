import type { CheckoutSession, RuntimeConfigRecord } from "@/lib/app-state/types";

export function makeRuntimeConfig(
  overrides: Partial<RuntimeConfigRecord> = {},
): RuntimeConfigRecord {
  return {
    network: "mainnet",
    api_base_url: "https://api.cipherpay.app",
    checkout_base_url: "https://cipherpay.app",
    api_key: "cipherpay-api-key",
    webhook_secret: "cipherpay-webhook-secret",
    luma_api_key: "luma-api-key",
    created_at: "2026-03-24T12:00:00.000Z",
    updated_at: "2026-03-24T12:00:00.000Z",
    ...overrides,
  };
}

export function makeCheckoutSession(
  overrides: Partial<CheckoutSession> = {},
): CheckoutSession {
  return {
    session_id: "session_123",
    network: "mainnet",
    event_api_id: "event_123",
    event_name: "ZecTix Event",
    ticket_type_api_id: "ticket_123",
    ticket_type_name: "Standard",
    attendee_name: "Jordan Lee",
    attendee_email: "jordan@example.com",
    amount: 12.5,
    currency: "USD",
    pricing_source: "luma",
    checkout_url: "https://cipherpay.app/checkout/session_123",
    cipherpay_invoice_id: "invoice_123",
    cipherpay_memo_code: "memo_123",
    cipherpay_payment_address: "u1testaddress",
    cipherpay_zcash_uri: "zcash:?address=u1testaddress&amount=12.5",
    cipherpay_price_zec: 0.125,
    cipherpay_expires_at: "2999-01-01T00:30:00.000Z",
    status: "pending",
    registration_status: "pending",
    registration_error: null,
    registration_failure_code: null,
    registration_attempt_count: 0,
    registration_last_attempt_at: null,
    registration_next_retry_at: null,
    luma_registration_json: null,
    last_event_type: "invoice.created",
    last_event_at: "2026-03-24T12:00:00.000Z",
    last_txid: null,
    last_payload_json: null,
    detected_at: null,
    confirmed_at: null,
    registered_at: null,
    refunded_at: null,
    created_at: "2026-03-24T12:00:00.000Z",
    updated_at: "2026-03-24T12:00:00.000Z",
    ...overrides,
  };
}
