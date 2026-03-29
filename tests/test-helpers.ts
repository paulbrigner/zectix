import type {
  CalendarConnection,
  CalendarEmbedTheme,
  CheckoutSession,
  CipherPayConnection,
  EventMirror,
  Tenant,
  TicketMirror,
} from "@/lib/app-state/types";

function makeCalendarEmbedTheme(
  overrides: Partial<CalendarEmbedTheme> = {},
): CalendarEmbedTheme {
  return {
    accent_color: null,
    background_color: null,
    surface_color: null,
    text_color: null,
    radius_px: null,
    ...overrides,
  };
}

export function makeTenant(overrides: Partial<Tenant> = {}): Tenant {
  return {
    tenant_id: "tenant_123",
    name: "Demo Organizer",
    slug: "demo-organizer",
    contact_email: "ops@example.com",
    status: "active",
    onboarding_source: "ops",
    onboarding_status: "completed",
    onboarding_started_at: null,
    onboarding_completed_at: "2026-03-24T12:00:00.000Z",
    monthly_minimum_usd_cents: 2500,
    service_fee_bps: 450,
    pilot_notes: null,
    created_at: "2026-03-24T12:00:00.000Z",
    updated_at: "2026-03-24T12:00:00.000Z",
    ...overrides,
  };
}

export function makeCalendarConnection(
  overrides: Partial<CalendarConnection> = {},
): CalendarConnection {
  return {
    calendar_connection_id: "calendar_123",
    tenant_id: "tenant_123",
    slug: "demo-calendar",
    display_name: "Demo Calendar",
    status: "active",
    luma_api_secret_ref: "local-secret/luma",
    luma_webhook_secret_ref: "local-secret/luma-webhook",
    luma_webhook_token_ref: "local-secret/luma-webhook-token",
    luma_webhook_id: "whk_123",
    last_validated_at: "2026-03-24T12:00:00.000Z",
    last_synced_at: "2026-03-24T12:00:00.000Z",
    last_sync_error: null,
    embed_enabled: false,
    embed_allowed_origins: [],
    embed_default_height_px: 860,
    embed_show_branding: true,
    embed_theme: makeCalendarEmbedTheme(),
    created_at: "2026-03-24T12:00:00.000Z",
    updated_at: "2026-03-24T12:00:00.000Z",
    ...overrides,
  };
}

export function makeCipherPayConnection(
  overrides: Partial<CipherPayConnection> = {},
): CipherPayConnection {
  return {
    cipherpay_connection_id: "cp_123",
    tenant_id: "tenant_123",
    calendar_connection_id: "calendar_123",
    network: "mainnet",
    api_base_url: "https://api.cipherpay.app",
    checkout_base_url: "https://cipherpay.app",
    cipherpay_api_secret_ref: "local-secret/cipherpay-api",
    cipherpay_webhook_secret_ref: "local-secret/cipherpay-webhook",
    status: "active",
    last_validated_at: "2026-03-24T12:00:00.000Z",
    last_validation_error: null,
    created_at: "2026-03-24T12:00:00.000Z",
    updated_at: "2026-03-24T12:00:00.000Z",
    ...overrides,
  };
}

export function makeEventMirror(overrides: Partial<EventMirror> = {}): EventMirror {
  return {
    event_mirror_id: "event_mirror_123",
    tenant_id: "tenant_123",
    calendar_connection_id: "calendar_123",
    event_api_id: "event_123",
    name: "ZecTix Launch Party",
    start_at: "2026-04-24T18:00:00.000Z",
    end_at: null,
    timezone: "America/New_York",
    description: "Celebrate the launch.",
    cover_url: null,
    url: "https://lu.ma/example",
    location_label: "Brooklyn, NY",
    location_note: null,
    sync_status: "active",
    zcash_enabled: true,
    zcash_enabled_reason: "At least one ticket is enabled for Zcash checkout.",
    last_synced_at: "2026-03-24T12:00:00.000Z",
    last_sync_hash: "hash",
    created_at: "2026-03-24T12:00:00.000Z",
    updated_at: "2026-03-24T12:00:00.000Z",
    ...overrides,
  };
}

export function makeTicketMirror(overrides: Partial<TicketMirror> = {}): TicketMirror {
  return {
    ticket_mirror_id: "ticket_mirror_123",
    tenant_id: "tenant_123",
    calendar_connection_id: "calendar_123",
    event_api_id: "event_123",
    ticket_type_api_id: "ticket_123",
    name: "General Admission",
    currency: "USD",
    amount: 25,
    description: "One attendee",
    active: true,
    price_source: "amount",
    zcash_enabled: true,
    zcash_enabled_reason: "Enabled for managed Zcash checkout.",
    confirmed_fixed_price: true,
    confirmed_no_approval_required: true,
    confirmed_no_extra_required_questions: true,
    automatic_eligibility_status: "eligible",
    automatic_eligibility_reasons: [],
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
    tenant_id: "tenant_123",
    calendar_connection_id: "calendar_123",
    cipherpay_connection_id: "cp_123",
    public_calendar_slug: "demo-calendar",
    network: "mainnet",
    event_api_id: "event_123",
    event_name: "ZecTix Launch Party",
    ticket_type_api_id: "ticket_123",
    ticket_type_name: "General Admission",
    attendee_name: "Jordan Lee",
    attendee_email: "jordan@example.com",
    amount: 25,
    currency: "USD",
    pricing_source: "mirror",
    pricing_snapshot_json: {
      amount: 25,
      currency: "USD",
      event_name: "ZecTix Launch Party",
      ticket_name: "General Admission",
    },
    service_fee_bps_snapshot: 450,
    service_fee_amount_snapshot: 1.13,
    checkout_url: "https://cipherpay.app/pay/invoice_123",
    cipherpay_invoice_id: "invoice_123",
    cipherpay_memo_code: "memo_123",
    cipherpay_payment_address: "u1testaddress",
    cipherpay_zcash_uri: "zcash:?address=u1testaddress&amount=0.01",
    cipherpay_price_zec: 0.01,
    cipherpay_expires_at: "2999-01-01T00:30:00.000Z",
    status: "pending",
    registration_status: "pending",
    registration_task_id: null,
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
