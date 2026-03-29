export type CipherPayNetwork = "testnet" | "mainnet";

export type SecretStoreBackend = "local" | "aws-secrets-manager";

export type CipherPaySessionStatus =
  | "draft"
  | "pending"
  | "underpaid"
  | "detected"
  | "confirmed"
  | "expired"
  | "refunded"
  | "unknown";

export type RegistrationStatus = "pending" | "registered" | "failed";

export type TenantStatus = "draft" | "active" | "suspended" | "archived";
export type TenantBillingStatus = "active" | "past_due" | "suspended";
export type TenantOnboardingSource = "ops" | "self_serve";
export type TenantOnboardingStatus =
  | "not_started"
  | "in_progress"
  | "ready_for_review"
  | "completed";
export type BillingCycleStatus =
  | "open"
  | "invoiced"
  | "paid"
  | "past_due"
  | "suspended"
  | "carried_over";
export type BillingAdjustmentType = "credit" | "waiver";
export type CalendarConnectionStatus =
  | "pending_validation"
  | "active"
  | "sync_error"
  | "disabled";
export type CipherPayConnectionStatus =
  | "pending_validation"
  | "active"
  | "error"
  | "disabled";
export type EventMirrorStatus = "active" | "canceled" | "hidden" | "error";
export type RegistrationTaskStatus =
  | "pending"
  | "in_progress"
  | "retry_wait"
  | "succeeded"
  | "failed"
  | "dead_letter";
export type UsageLedgerStatus = "billable" | "waived" | "credited";
export type WebhookProvider = "cipherpay" | "luma";
export type WebhookApplyStatus = "received" | "applied" | "ignored" | "error";

export type CalendarEmbedTheme = {
  accent_color: string | null;
  background_color: string | null;
  surface_color: string | null;
  text_color: string | null;
  radius_px: number | null;
};

export type Tenant = {
  tenant_id: string;
  name: string;
  slug: string;
  contact_email: string;
  status: TenantStatus;
  billing_status: TenantBillingStatus;
  onboarding_source: TenantOnboardingSource;
  onboarding_status: TenantOnboardingStatus;
  onboarding_started_at: string | null;
  onboarding_completed_at: string | null;
  service_fee_bps: number;
  billing_grace_days: number;
  settlement_threshold_zatoshis: number;
  pilot_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CalendarConnection = {
  calendar_connection_id: string;
  tenant_id: string;
  slug: string;
  display_name: string;
  status: CalendarConnectionStatus;
  luma_api_secret_ref: string | null;
  luma_webhook_secret_ref: string | null;
  luma_webhook_token_ref: string | null;
  luma_webhook_id: string | null;
  last_validated_at: string | null;
  last_synced_at: string | null;
  last_sync_error: string | null;
  embed_enabled: boolean;
  embed_allowed_origins: string[];
  embed_default_height_px: number;
  embed_show_branding: boolean;
  embed_theme: CalendarEmbedTheme;
  created_at: string;
  updated_at: string;
};

export type CipherPayConnection = {
  cipherpay_connection_id: string;
  tenant_id: string;
  calendar_connection_id: string;
  network: CipherPayNetwork;
  api_base_url: string;
  checkout_base_url: string;
  cipherpay_api_secret_ref: string | null;
  cipherpay_webhook_secret_ref: string | null;
  status: CipherPayConnectionStatus;
  last_validated_at: string | null;
  last_validation_error: string | null;
  created_at: string;
  updated_at: string;
};

export type EventMirror = {
  event_mirror_id: string;
  tenant_id: string;
  calendar_connection_id: string;
  event_api_id: string;
  name: string;
  start_at: string;
  end_at: string | null;
  timezone: string | null;
  description: string | null;
  cover_url: string | null;
  url: string | null;
  location_label: string | null;
  location_note: string | null;
  sync_status: EventMirrorStatus;
  zcash_enabled: boolean;
  zcash_enabled_reason: string | null;
  last_synced_at: string | null;
  last_sync_hash: string | null;
  created_at: string;
  updated_at: string;
};

export type TicketMirror = {
  ticket_mirror_id: string;
  tenant_id: string;
  calendar_connection_id: string;
  event_api_id: string;
  ticket_type_api_id: string;
  name: string;
  currency: string | null;
  amount: number | null;
  description: string | null;
  active: boolean;
  price_source: "amount" | "fallback";
  zcash_enabled: boolean;
  zcash_enabled_reason: string | null;
  confirmed_fixed_price: boolean;
  confirmed_no_approval_required: boolean;
  confirmed_no_extra_required_questions: boolean;
  automatic_eligibility_status: "eligible" | "ineligible";
  automatic_eligibility_reasons: string[];
  created_at: string;
  updated_at: string;
};

export type CheckoutSession = {
  session_id: string;
  tenant_id: string;
  calendar_connection_id: string;
  cipherpay_connection_id: string;
  public_calendar_slug: string;
  network: CipherPayNetwork;
  event_api_id: string;
  event_name: string;
  ticket_type_api_id: string;
  ticket_type_name: string;
  attendee_name: string;
  attendee_email: string;
  amount: number;
  currency: string;
  pricing_source: "mirror";
  pricing_snapshot_json: Record<string, unknown>;
  service_fee_bps_snapshot: number;
  service_fee_zatoshis_snapshot: number;
  checkout_url: string | null;
  cipherpay_invoice_id: string;
  cipherpay_memo_code: string | null;
  cipherpay_payment_address: string | null;
  cipherpay_zcash_uri: string | null;
  cipherpay_price_zec: number | null;
  cipherpay_price_zatoshis: number | null;
  cipherpay_expires_at: string | null;
  status: CipherPaySessionStatus;
  registration_status: RegistrationStatus;
  registration_task_id: string | null;
  registration_error: string | null;
  registration_failure_code: string | null;
  registration_attempt_count: number;
  registration_last_attempt_at: string | null;
  registration_next_retry_at: string | null;
  luma_registration_json: Record<string, unknown> | null;
  last_event_type: string | null;
  last_event_at: string | null;
  last_txid: string | null;
  last_payload_json: Record<string, unknown> | null;
  detected_at: string | null;
  confirmed_at: string | null;
  registered_at: string | null;
  refunded_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WebhookDelivery = {
  webhook_delivery_id: string;
  provider: WebhookProvider;
  tenant_id: string | null;
  calendar_connection_id: string | null;
  session_id: string | null;
  cipherpay_invoice_id: string | null;
  event_api_id: string | null;
  event_type: string | null;
  signature_valid: boolean;
  validation_error: string | null;
  request_body_json: Record<string, unknown> | null;
  request_headers_json: Record<string, unknown> | null;
  received_at: string;
  applied_at: string | null;
  apply_status: WebhookApplyStatus;
};

export type RegistrationTask = {
  task_id: string;
  tenant_id: string;
  calendar_connection_id: string;
  session_id: string;
  cipherpay_invoice_id: string;
  status: RegistrationTaskStatus;
  attempt_count: number;
  next_attempt_at: string;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  last_attempt_at: string | null;
};

export type UsageLedgerEntry = {
  usage_entry_id: string;
  tenant_id: string;
  calendar_connection_id: string;
  session_id: string;
  cipherpay_invoice_id: string;
  event_api_id: string;
  gross_zatoshis: number;
  service_fee_bps: number;
  service_fee_zatoshis: number;
  recognized_at: string;
  billing_period: string;
  billing_cycle_id: string;
  status: UsageLedgerStatus;
};

export type BillingCycle = {
  billing_cycle_id: string;
  tenant_id: string;
  billing_period: string;
  period_start: string;
  period_end: string;
  grace_until: string;
  status: BillingCycleStatus;
  recognized_session_count: number;
  gross_zatoshis: number;
  service_fee_zatoshis: number;
  credited_zatoshis: number;
  waived_zatoshis: number;
  outstanding_zatoshis: number;
  invoice_reference: string | null;
  settlement_txid: string | null;
  invoiced_at: string | null;
  paid_at: string | null;
  last_reconciled_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BillingAdjustment = {
  adjustment_id: string;
  billing_cycle_id: string;
  tenant_id: string;
  type: BillingAdjustmentType;
  amount_zatoshis: number;
  reason: string;
  created_at: string;
};

export type AdminAuditEvent = {
  event_id: string;
  event_type: string;
  actor_ip: string | null;
  actor_origin: string | null;
  request_headers_json: Record<string, unknown> | null;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
};

export type SecretPreview = {
  ref: string | null;
  preview: string | null;
  has_value: boolean;
};

export type TenantListItem = {
  tenant: Tenant;
  active_calendar_count: number;
  recent_session_count: number;
  open_registration_tasks: number;
  dead_letter_tasks: number;
};

export type OpsDashboardData = {
  tenants: TenantListItem[];
  recent_sessions: CheckoutSession[];
  recent_webhooks: WebhookDelivery[];
  recent_tasks: RegistrationTask[];
};

export type BillingReportRow = {
  tenant_id: string;
  tenant_name: string;
  billing_cycle_id: string;
  billing_period: string;
  period_start: string;
  period_end: string;
  status: BillingCycleStatus;
  session_count: number;
  gross_zatoshis: number;
  service_fee_zatoshis: number;
  credited_zatoshis: number;
  waived_zatoshis: number;
  outstanding_zatoshis: number;
};

export type PublicCalendar = {
  tenant: Tenant;
  calendar: CalendarConnection;
  events: EventMirror[];
};

export type PublicEventPageData = {
  tenant: Tenant;
  calendar: CalendarConnection;
  event: EventMirror;
  tickets: TicketMirror[];
};
