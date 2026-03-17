export type CipherPayNetwork = "testnet" | "mainnet";

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

export type TestConfigRecord = {
  network: CipherPayNetwork;
  api_base_url: string;
  checkout_base_url: string;
  api_key: string | null;
  webhook_secret: string | null;
  luma_api_key: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type TestConfig = {
  network: CipherPayNetwork;
  api_base_url: string;
  checkout_base_url: string;
  has_api_key: boolean;
  api_key_preview: string | null;
  has_webhook_secret: boolean;
  webhook_secret_preview: string | null;
  has_luma_api_key: boolean;
  luma_api_key_preview: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type TestSession = {
  session_id: string;
  network: CipherPayNetwork;
  event_api_id: string;
  event_name: string;
  ticket_type_api_id: string | null;
  ticket_type_name: string | null;
  attendee_name: string;
  attendee_email: string;
  amount: number;
  currency: string;
  pricing_source: "luma" | "fallback";
  checkout_url: string | null;
  cipherpay_invoice_id: string;
  cipherpay_memo_code: string | null;
  cipherpay_payment_address: string | null;
  cipherpay_zcash_uri: string | null;
  cipherpay_price_zec: number | null;
  cipherpay_expires_at: string | null;
  status: CipherPaySessionStatus;
  registration_status: RegistrationStatus;
  registration_error: string | null;
  luma_registration_json: Record<string, unknown> | null;
  last_event_type: string | null;
  last_event_at: string | null;
  last_txid: string | null;
  last_payload_json: Record<string, unknown> | null;
  detected_at: string | null;
  confirmed_at: string | null;
  registered_at: string | null;
  refunded_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type TestWebhookEvent = {
  event_id: string;
  cipherpay_invoice_id: string | null;
  event_type: string | null;
  txid: string | null;
  signature_valid: boolean;
  validation_error: string | null;
  timestamp_header: string | null;
  request_body_json: Record<string, unknown> | null;
  request_headers_json: Record<string, unknown> | null;
  received_at: string | null;
};

export type TestDashboardData = {
  config: TestConfig;
  stats: {
    total_sessions: number;
    pending_sessions: number;
    detected_sessions: number;
    confirmed_sessions: number;
    expired_sessions: number;
    registered_sessions: number;
    failed_registrations: number;
    invalid_webhooks: number;
  };
  sessions: TestSession[];
  recent_webhooks: TestWebhookEvent[];
};
