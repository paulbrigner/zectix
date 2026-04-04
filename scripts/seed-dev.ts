/**
 * Seed the local DynamoDB with realistic demo data.
 *
 * Requires DynamoDB Local running (docker compose up) and the table created (npm run db:init).
 * Populates data under the existing "Test Org" tenant so the dashboard session works as-is.
 *
 * Usage: npm run db:seed
 */

import {
  putTenant,
  putCalendarConnection,
  putCipherPayConnection,
  putEventMirror,
  putTicketMirror,
  putSession,
  putWebhookDelivery,
  putRegistrationTask,
  putBillingCycle,
} from "@/lib/app-state/state";

import type {
  BillingCycle,
  CalendarConnection,
  CheckoutSession,
  CipherPayConnection,
  EventMirror,
  RegistrationTask,
  Tenant,
  TicketMirror,
  WebhookDelivery,
} from "@/lib/app-state/types";

import { LocalDevSecretStore } from "@/lib/secrets/local";

// ─── Existing tenant — must match your local session ───────────────────────
const TENANT_ID = "8a1bd4b4-2542-4835-ba08-96ac686e377d";

const NOW = new Date().toISOString();
const hours = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
const days = (d: number) => new Date(Date.now() - d * 86400_000).toISOString();
const future = (d: number) => new Date(Date.now() + d * 86400_000).toISOString();

const CREATED = days(14);

// ─── Tenant update (mark onboarding complete + active) ─────────────────────
const tenant: Tenant = {
  tenant_id: TENANT_ID,
  name: "Test Org",
  slug: "test-org",
  contact_email: "dev@test.com",
  status: "active",
  billing_status: "active",
  onboarding_source: "self_serve",
  onboarding_status: "completed",
  onboarding_started_at: CREATED,
  onboarding_completed_at: days(7),
  service_fee_bps: 450,
  billing_grace_days: 7,
  settlement_threshold_zatoshis: 1_000_000,
  pilot_notes: null,
  created_at: CREATED,
  updated_at: NOW,
};

// ─── Calendar ──────────────────────────────────────────────────────────────
const CAL_ID = "cal_seed_001";
const calendar: CalendarConnection = {
  calendar_connection_id: CAL_ID,
  tenant_id: TENANT_ID,
  slug: "test-org-events",
  display_name: "Test Org Events",
  status: "active",
  luma_api_secret_ref: "seed/luma-api",
  luma_webhook_secret_ref: "seed/luma-wh",
  luma_webhook_token_ref: "seed/luma-wh-token",
  luma_webhook_id: "whk_seed_001",
  last_validated_at: hours(6),
  last_synced_at: hours(2),
  last_sync_error: null,
  embed_enabled: true,
  embed_allowed_origins: ["https://test-org.example.com"],
  embed_dynamic_height: true,
  embed_default_height_px: 860,
  embed_show_branding: true,
  embed_theme: {
    accent_color: null,
    background_color: null,
    surface_color: null,
    text_color: null,
    radius_px: null,
  },
  created_at: CREATED,
  updated_at: hours(2),
};

// ─── CipherPay ─────────────────────────────────────────────────────────────
const CP_ID = "cp_seed_001";
const cpConnection: CipherPayConnection = {
  cipherpay_connection_id: CP_ID,
  tenant_id: TENANT_ID,
  calendar_connection_id: CAL_ID,
  network: "testnet",
  api_base_url: "https://api.cipherpay.app",
  checkout_base_url: "https://cipherpay.app",
  cipherpay_api_secret_ref: "seed/cp-api",
  cipherpay_webhook_secret_ref: "seed/cp-wh",
  status: "active",
  last_validated_at: hours(6),
  last_validation_error: null,
  created_at: CREATED,
  updated_at: hours(6),
};

// ─── Events ────────────────────────────────────────────────────────────────
const events: EventMirror[] = [
  {
    event_mirror_id: "em_seed_1",
    tenant_id: TENANT_ID,
    calendar_connection_id: CAL_ID,
    event_api_id: "evt_seed_1",
    name: "Zcash Privacy Summit 2026",
    start_at: future(14),
    end_at: future(14),
    timezone: "America/New_York",
    description: "Annual privacy summit bringing together researchers, builders, and advocates.",
    cover_url: null,
    url: "https://lu.ma/zcash-summit-2026",
    location_label: "Brooklyn, NY",
    location_note: null,
    sync_status: "active",
    public_checkout_requested: true,
    zcash_enabled: true,
    zcash_enabled_reason: "At least one ticket is enabled for Zcash checkout.",
    last_synced_at: hours(2),
    last_sync_hash: "hash_1",
    created_at: days(10),
    updated_at: hours(2),
  },
  {
    event_mirror_id: "em_seed_2",
    tenant_id: TENANT_ID,
    calendar_connection_id: CAL_ID,
    event_api_id: "evt_seed_2",
    name: "Web3 Privacy Meetup",
    start_at: future(21),
    end_at: future(21),
    timezone: "America/New_York",
    description: "Casual developer meetup focused on privacy-preserving technologies.",
    cover_url: null,
    url: "https://lu.ma/web3-privacy",
    location_label: "Manhattan, NY",
    location_note: null,
    sync_status: "active",
    public_checkout_requested: true,
    zcash_enabled: true,
    zcash_enabled_reason: "At least one ticket is enabled for Zcash checkout.",
    last_synced_at: hours(2),
    last_sync_hash: "hash_2",
    created_at: days(8),
    updated_at: hours(2),
  },
  {
    event_mirror_id: "em_seed_3",
    tenant_id: TENANT_ID,
    calendar_connection_id: CAL_ID,
    event_api_id: "evt_seed_3",
    name: "Shielded Transactions Workshop",
    start_at: future(35),
    end_at: future(35),
    timezone: "America/New_York",
    description: "Hands-on workshop for developers building with shielded transactions.",
    cover_url: null,
    url: "https://lu.ma/shielded-workshop",
    location_label: "Online",
    location_note: null,
    sync_status: "active",
    public_checkout_requested: true,
    zcash_enabled: true,
    zcash_enabled_reason: "At least one ticket is enabled for Zcash checkout.",
    last_synced_at: hours(2),
    last_sync_hash: "hash_3",
    created_at: days(5),
    updated_at: hours(2),
  },
];

// ─── Tickets ───────────────────────────────────────────────────────────────
const tickets: TicketMirror[] = [
  {
    ticket_mirror_id: "tm_seed_1", tenant_id: TENANT_ID, calendar_connection_id: CAL_ID,
    event_api_id: "evt_seed_1", ticket_type_api_id: "tkt_seed_1",
    name: "General Admission", currency: "USD", amount: 45,
    description: "One attendee", active: true, price_source: "amount",
    public_checkout_requested: true, zcash_enabled: true,
    zcash_enabled_reason: "Enabled for managed Zcash checkout.",
    automatic_eligibility_status: "eligible", automatic_eligibility_reasons: [],
    created_at: days(10), updated_at: hours(2),
  },
  {
    ticket_mirror_id: "tm_seed_2", tenant_id: TENANT_ID, calendar_connection_id: CAL_ID,
    event_api_id: "evt_seed_1", ticket_type_api_id: "tkt_seed_2",
    name: "VIP Access", currency: "USD", amount: 120,
    description: "VIP with speaker dinner access", active: true, price_source: "amount",
    public_checkout_requested: true, zcash_enabled: true,
    zcash_enabled_reason: "Enabled for managed Zcash checkout.",
    automatic_eligibility_status: "eligible", automatic_eligibility_reasons: [],
    created_at: days(10), updated_at: hours(2),
  },
  {
    ticket_mirror_id: "tm_seed_3", tenant_id: TENANT_ID, calendar_connection_id: CAL_ID,
    event_api_id: "evt_seed_2", ticket_type_api_id: "tkt_seed_3",
    name: "Free RSVP", currency: "USD", amount: 0,
    description: "Free entry — RSVP required", active: true, price_source: "amount",
    public_checkout_requested: true, zcash_enabled: true,
    zcash_enabled_reason: "Enabled for managed Zcash checkout.",
    automatic_eligibility_status: "eligible", automatic_eligibility_reasons: [],
    created_at: days(8), updated_at: hours(2),
  },
  {
    ticket_mirror_id: "tm_seed_4", tenant_id: TENANT_ID, calendar_connection_id: CAL_ID,
    event_api_id: "evt_seed_3", ticket_type_api_id: "tkt_seed_4",
    name: "Workshop Seat", currency: "USD", amount: 30,
    description: "One seat — limited capacity", active: true, price_source: "amount",
    public_checkout_requested: true, zcash_enabled: true,
    zcash_enabled_reason: "Enabled for managed Zcash checkout.",
    automatic_eligibility_status: "eligible", automatic_eligibility_reasons: [],
    created_at: days(5), updated_at: hours(2),
  },
];

// ─── Sessions ──────────────────────────────────────────────────────────────
function session(
  id: string, eventApiId: string, eventName: string,
  ticketApiId: string, ticketName: string,
  name: string, email: string, amount: number,
  status: CheckoutSession["status"],
  regStatus: CheckoutSession["registration_status"],
  createdAt: string, updatedAt: string,
): CheckoutSession {
  return {
    session_id: id, tenant_id: TENANT_ID, calendar_connection_id: CAL_ID,
    cipherpay_connection_id: CP_ID, public_calendar_slug: "test-org-events",
    network: "testnet", event_api_id: eventApiId, event_name: eventName,
    ticket_type_api_id: ticketApiId, ticket_type_name: ticketName,
    attendee_name: name, attendee_email: email,
    amount, currency: "USD", pricing_source: "mirror",
    pricing_snapshot_json: { amount, currency: "USD", event_name: eventName, ticket_name: ticketName },
    service_fee_bps_snapshot: 450, service_fee_zatoshis_snapshot: Math.round(amount * 10000),
    checkout_url: `https://cipherpay.app/pay/inv_${id}`,
    cipherpay_invoice_id: `inv_${id}`, cipherpay_memo_code: `memo_${id}`,
    cipherpay_payment_address: "u1seedaddr",
    cipherpay_zcash_uri: `zcash:u1seedaddr?amount=${(amount * 0.01).toFixed(4)}`,
    cipherpay_price_zec: amount * 0.01, cipherpay_price_zatoshis: amount * 1_000_000,
    cipherpay_expires_at: future(7),
    status, registration_status: regStatus,
    registration_task_id: regStatus === "registered" ? `task_${id}` : null,
    registration_error: null, registration_failure_code: null,
    registration_attempt_count: regStatus === "registered" ? 1 : 0,
    registration_last_attempt_at: regStatus === "registered" ? updatedAt : null,
    registration_next_retry_at: null, luma_registration_json: null,
    last_event_type: status === "confirmed" ? "invoice.settled" : status === "detected" ? "invoice.detected" : "invoice.created",
    last_event_at: updatedAt,
    last_txid: status === "confirmed" || status === "detected" ? `txid_${id}` : null,
    last_payload_json: null,
    detected_at: status === "detected" || status === "confirmed" ? updatedAt : null,
    confirmed_at: status === "confirmed" ? updatedAt : null,
    registered_at: regStatus === "registered" ? updatedAt : null,
    refunded_at: null, version: 1,
    created_at: createdAt, updated_at: updatedAt,
  };
}

const sessions: CheckoutSession[] = [
  session("s_seed_1", "evt_seed_1", "Zcash Privacy Summit 2026", "tkt_seed_1", "General Admission", "Alice Chen", "alice@example.com", 45, "confirmed", "registered", days(3), days(2)),
  session("s_seed_2", "evt_seed_1", "Zcash Privacy Summit 2026", "tkt_seed_2", "VIP Access", "Bob Martinez", "bob@example.com", 120, "confirmed", "registered", days(3), days(2)),
  session("s_seed_3", "evt_seed_1", "Zcash Privacy Summit 2026", "tkt_seed_1", "General Admission", "Carol Diaz", "carol@example.com", 45, "confirmed", "registered", days(4), days(3)),
  session("s_seed_4", "evt_seed_2", "Web3 Privacy Meetup", "tkt_seed_3", "Free RSVP", "Dave Park", "dave@example.com", 0, "confirmed", "registered", days(2), days(1)),
  session("s_seed_5", "evt_seed_1", "Zcash Privacy Summit 2026", "tkt_seed_1", "General Admission", "Eve Fischer", "eve@example.com", 45, "detected", "pending", days(1), hours(4)),
  session("s_seed_6", "evt_seed_3", "Shielded Transactions Workshop", "tkt_seed_4", "Workshop Seat", "Frank Gomez", "frank@example.com", 30, "pending", "pending", hours(8), hours(8)),
  session("s_seed_7", "evt_seed_1", "Zcash Privacy Summit 2026", "tkt_seed_2", "VIP Access", "Grace Kim", "grace@example.com", 120, "expired", "pending", days(7), days(5)),
];

// ─── Webhooks ──────────────────────────────────────────────────────────────
const webhooks: WebhookDelivery[] = [
  {
    webhook_delivery_id: "wh_seed_1", provider: "cipherpay", tenant_id: TENANT_ID,
    calendar_connection_id: CAL_ID, session_id: "s_seed_1", cipherpay_invoice_id: "inv_s_seed_1",
    event_api_id: "evt_seed_1", event_type: "invoice.settled", signature_valid: true,
    validation_error: null, request_body_json: null, request_headers_json: null,
    received_at: days(2), applied_at: days(2), apply_status: "applied",
  },
  {
    webhook_delivery_id: "wh_seed_2", provider: "cipherpay", tenant_id: TENANT_ID,
    calendar_connection_id: CAL_ID, session_id: "s_seed_2", cipherpay_invoice_id: "inv_s_seed_2",
    event_api_id: "evt_seed_1", event_type: "invoice.settled", signature_valid: true,
    validation_error: null, request_body_json: null, request_headers_json: null,
    received_at: days(2), applied_at: days(2), apply_status: "applied",
  },
  {
    webhook_delivery_id: "wh_seed_3", provider: "cipherpay", tenant_id: TENANT_ID,
    calendar_connection_id: CAL_ID, session_id: "s_seed_5", cipherpay_invoice_id: "inv_s_seed_5",
    event_api_id: "evt_seed_1", event_type: "invoice.detected", signature_valid: true,
    validation_error: null, request_body_json: null, request_headers_json: null,
    received_at: hours(4), applied_at: hours(4), apply_status: "applied",
  },
  {
    webhook_delivery_id: "wh_seed_4", provider: "luma", tenant_id: TENANT_ID,
    calendar_connection_id: CAL_ID, session_id: null, cipherpay_invoice_id: null,
    event_api_id: "evt_seed_1", event_type: "event.updated", signature_valid: true,
    validation_error: null, request_body_json: null, request_headers_json: null,
    received_at: hours(2), applied_at: hours(2), apply_status: "applied",
  },
];

// ─── Registration tasks ────────────────────────────────────────────────────
const registrationTasks: RegistrationTask[] = [
  {
    task_id: "task_s_seed_1", tenant_id: TENANT_ID, calendar_connection_id: CAL_ID,
    session_id: "s_seed_1", cipherpay_invoice_id: "inv_s_seed_1", status: "succeeded",
    attempt_count: 1, next_attempt_at: days(2), last_error: null,
    created_at: days(2), updated_at: days(2), last_attempt_at: days(2),
  },
  {
    task_id: "task_s_seed_2", tenant_id: TENANT_ID, calendar_connection_id: CAL_ID,
    session_id: "s_seed_2", cipherpay_invoice_id: "inv_s_seed_2", status: "succeeded",
    attempt_count: 1, next_attempt_at: days(2), last_error: null,
    created_at: days(2), updated_at: days(2), last_attempt_at: days(2),
  },
  {
    task_id: "task_s_seed_3", tenant_id: TENANT_ID, calendar_connection_id: CAL_ID,
    session_id: "s_seed_3", cipherpay_invoice_id: "inv_s_seed_3", status: "succeeded",
    attempt_count: 1, next_attempt_at: days(3), last_error: null,
    created_at: days(3), updated_at: days(3), last_attempt_at: days(3),
  },
];

// ─── Billing ───────────────────────────────────────────────────────────────
const billingCycle: BillingCycle = {
  billing_cycle_id: "bc_seed_1",
  tenant_id: TENANT_ID,
  billing_period: new Date().toISOString().slice(0, 7),
  period_start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
  period_end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59, 999).toISOString(),
  grace_until: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 7, 23, 59, 59, 999).toISOString(),
  status: "open",
  recognized_session_count: 4,
  gross_zatoshis: 255_000_000,
  service_fee_zatoshis: 11_475_000,
  credited_zatoshis: 0,
  waived_zatoshis: 0,
  outstanding_zatoshis: 11_475_000,
  invoice_reference: null,
  settlement_txid: null,
  invoiced_at: null,
  paid_at: null,
  last_reconciled_at: null,
  created_at: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
  updated_at: NOW,
};

// ─── Secrets ───────────────────────────────────────────────────────────────
async function seedSecrets() {
  const store = new LocalDevSecretStore();
  const secrets: Record<string, string> = {
    "seed/luma-api": "lk_test_a8f3b2c4d5e6f7g8h9i0",
    "seed/luma-wh": "whsec_test_9d8e7f6a5b4c3d2e1f0g",
    "seed/luma-wh-token": "whtoken_test_1a2b3c4d5e",
    "seed/cp-api": "cpk_test_m4x9n8p7q6r5s4t3u2v1",
    "seed/cp-wh": "cpwh_test_r2d3e4f5g6h7i8j9k0l1",
  };

  for (const [ref, value] of Object.entries(secrets)) {
    await store.setSecret(ref, value);
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log("Seeding local DynamoDB...\n");

  console.log("  Tenant:       %s (%s)", tenant.name, tenant.tenant_id);
  await putTenant(tenant);
  console.log("  ✓ Tenant updated → active, onboarding completed");

  await putCalendarConnection(calendar);
  console.log("  ✓ Calendar:   %s (%s)", calendar.display_name, calendar.slug);

  await putCipherPayConnection(cpConnection, { attachToCalendar: true });
  console.log("  ✓ CipherPay:  %s on %s", cpConnection.network, cpConnection.status);

  for (const event of events) {
    await putEventMirror(event);
  }
  console.log("  ✓ Events:     %d mirrored events", events.length);

  for (const ticket of tickets) {
    await putTicketMirror(ticket);
  }
  console.log("  ✓ Tickets:    %d ticket types", tickets.length);

  for (const s of sessions) {
    await putSession(s);
  }
  console.log("  ✓ Sessions:   %d checkout sessions", sessions.length);

  for (const wh of webhooks) {
    await putWebhookDelivery(wh);
  }
  console.log("  ✓ Webhooks:   %d deliveries", webhooks.length);

  for (const task of registrationTasks) {
    await putRegistrationTask(task);
  }
  console.log("  ✓ Tasks:      %d registration tasks", registrationTasks.length);

  await putBillingCycle(billingCycle);
  console.log("  ✓ Billing:    cycle %s (open)", billingCycle.billing_period);

  await seedSecrets();
  console.log("  ✓ Secrets:    5 mock API keys written to local store");

  console.log("\nDone. Refresh your dashboard to see the populated data.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
