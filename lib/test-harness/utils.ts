import type {
  CipherPayNetwork,
  CipherPaySessionStatus,
  TestConfig,
  TestConfigRecord,
} from "@/lib/test-harness/types";

const SESSION_STATUSES = new Set<CipherPaySessionStatus>([
  "draft",
  "pending",
  "underpaid",
  "detected",
  "confirmed",
  "expired",
  "refunded",
  "unknown",
]);

export function nowIso() {
  return new Date().toISOString();
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

export function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function asBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }

  return fallback;
}

export function asIsoTimestamp(value: unknown): string | null {
  const text = asString(value);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function normalizeCurrencyCode(
  value: unknown,
  fallback = "USD",
): string {
  const text = asString(value)?.toUpperCase();
  return text && text.length === 3 ? text : fallback;
}

export function normalizeCipherPayNetwork(
  value: unknown,
  fallback: CipherPayNetwork = "testnet",
): CipherPayNetwork {
  return value === "mainnet" ? "mainnet" : fallback;
}

export function isCipherPayStatus(value: unknown): value is CipherPaySessionStatus {
  return typeof value === "string" && SESSION_STATUSES.has(value as CipherPaySessionStatus);
}

export function cipherPayDefaultsForNetwork(network: CipherPayNetwork) {
  if (network === "mainnet") {
    return {
      apiBaseUrl: "https://api.cipherpay.app",
      checkoutBaseUrl: "https://cipherpay.app",
    };
  }

  return {
    apiBaseUrl: "https://api.testnet.cipherpay.app",
    checkoutBaseUrl: "https://testnet.cipherpay.app",
  };
}

export function defaultConfigRecord(
  network: CipherPayNetwork = "testnet",
): TestConfigRecord {
  const defaults = cipherPayDefaultsForNetwork(network);

  return {
    network,
    api_base_url: defaults.apiBaseUrl,
    checkout_base_url: defaults.checkoutBaseUrl,
    api_key: null,
    webhook_secret: null,
    luma_api_key: null,
    created_at: null,
    updated_at: null,
  };
}

export function maskSecretPreview(value: string | null | undefined): string | null {
  const text = asString(value);
  if (!text) return null;
  if (text.length <= 8) return `${text.slice(0, 2)}••••`;
  return `${text.slice(0, 6)}••••${text.slice(-4)}`;
}

export function toPublicConfig(record: TestConfigRecord): TestConfig {
  return {
    network: record.network,
    api_base_url: record.api_base_url,
    checkout_base_url: record.checkout_base_url,
    has_api_key: Boolean(asString(record.api_key)),
    api_key_preview: maskSecretPreview(record.api_key),
    has_webhook_secret: Boolean(asString(record.webhook_secret)),
    webhook_secret_preview: maskSecretPreview(record.webhook_secret),
    has_luma_api_key: Boolean(asString(record.luma_api_key)),
    luma_api_key_preview: maskSecretPreview(record.luma_api_key),
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

export function hasCoreTestSetup(
  config:
    | Pick<TestConfigRecord, "api_key" | "luma_api_key">
    | Pick<TestConfig, "has_api_key" | "has_luma_api_key">,
) {
  if ("has_api_key" in config && "has_luma_api_key" in config) {
    return config.has_api_key && config.has_luma_api_key;
  }

  return Boolean(asString(config.api_key) && asString(config.luma_api_key));
}

export function formatFiatAmount(amount: number | null, currency: string | null) {
  if (amount == null || !currency) return "n/a";

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function cipherPayStatusFromEvent(
  eventType: string | null,
  fallback: CipherPaySessionStatus = "unknown",
): CipherPaySessionStatus {
  const normalized = asString(eventType)?.toLowerCase();
  if (!normalized) return fallback;
  if (isCipherPayStatus(normalized)) return normalized;
  if (normalized === "invoice.created") return "draft";
  if (normalized === "subscription.renewed") return "confirmed";
  if (normalized === "subscription.past_due") return "expired";
  if (normalized === "subscription.canceled") return "expired";
  return fallback;
}

export function sortByIsoDateDesc<T>(
  items: T[],
  pickDate: (item: T) => string | null,
) {
  return [...items].sort((a, b) => {
    const left = pickDate(a) ? new Date(pickDate(a) as string).getTime() : 0;
    const right = pickDate(b) ? new Date(pickDate(b) as string).getTime() : 0;
    return right - left;
  });
}
