import type {
  CheckoutSession,
  CipherPayNetwork,
  CipherPaySessionStatus,
} from "@/lib/app-state/types";

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

const LOCALLY_EXPIRABLE_SESSION_STATUSES = new Set<CipherPaySessionStatus>([
  "draft",
  "pending",
  "underpaid",
  "unknown",
]);

export const ZATOSHIS_PER_ZEC = 100_000_000;
const EMAIL_LOCAL_PART_PATTERN = /^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/i;
const EMAIL_DOMAIN_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
const EMAIL_TLD_PATTERN = /^(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/i;

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

export function asNonNegativeInteger(value: unknown, fallback = 0) {
  const parsed = asFiniteNumber(value);
  if (parsed == null) {
    return fallback;
  }

  const rounded = Math.floor(parsed);
  return rounded >= 0 ? rounded : fallback;
}

export function asBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "on") {
      return true;
    }
    if (normalized === "false" || normalized === "0" || normalized === "off") {
      return false;
    }
  }

  return fallback;
}

export function asIsoTimestamp(value: unknown): string | null {
  const text = asString(value);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function normalizeEmailAddress(value: string | null | undefined) {
  return value?.trim().toLowerCase() || "";
}

export function isValidEmailAddress(value: string | null | undefined) {
  const normalized = normalizeEmailAddress(value);
  if (normalized.length === 0 || normalized.length > 320) {
    return false;
  }

  const parts = normalized.split("@");
  if (parts.length !== 2) {
    return false;
  }

  const [localPart, domain] = parts;
  if (!localPart || !domain || localPart.length > 64 || domain.length > 255) {
    return false;
  }

  if (
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    localPart.includes("..") ||
    !EMAIL_LOCAL_PART_PATTERN.test(localPart)
  ) {
    return false;
  }

  const labels = domain.split(".");
  if (labels.length < 2 || labels.some((label) => label.length === 0)) {
    return false;
  }

  const topLevelDomain = labels[labels.length - 1] || "";
  if (!EMAIL_TLD_PATTERN.test(topLevelDomain)) {
    return false;
  }

  return labels.every((label) => EMAIL_DOMAIN_LABEL_PATTERN.test(label));
}

export function normalizeCurrencyCode(value: unknown, fallback = "USD") {
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

export function supportedTicketCurrencies() {
  const source = asString(process.env.SUPPORTED_TICKET_CURRENCIES) || "USD";
  return new Set(
    source
      .split(",")
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean),
  );
}

export function maskSecretPreview(value: string | null | undefined): string | null {
  const text = asString(value);
  if (!text) return null;
  if (text.length <= 8) return `${text.slice(0, 2)}••••`;
  return `${text.slice(0, 6)}••••${text.slice(-4)}`;
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

export function slugify(value: string, fallback = "item") {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

export function billingPeriodForTimestamp(value: string | null | undefined) {
  const parsed = new Date(String(value || ""));
  if (Number.isNaN(parsed.getTime())) {
    return "unknown";
  }

  return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function zecToZatoshis(amount: number | null | undefined) {
  if (amount == null || !Number.isFinite(amount)) {
    return null;
  }

  return Math.max(0, Math.round(amount * ZATOSHIS_PER_ZEC));
}

export function zatoshisToZec(amount: number | null | undefined) {
  if (amount == null || !Number.isFinite(amount)) {
    return null;
  }

  return amount / ZATOSHIS_PER_ZEC;
}

export function formatZecAmount(amountZatoshis: number | null | undefined) {
  const amountZec = zatoshisToZec(amountZatoshis);
  if (amountZec == null) {
    return "n/a";
  }

  return `${amountZec.toFixed(8).replace(/0+$/, "").replace(/\.$/, "")} ZEC`;
}

export function calculateServiceFeeZatoshis(
  grossZatoshis: number | null | undefined,
  serviceFeeBps: number,
) {
  if (grossZatoshis == null || !Number.isFinite(grossZatoshis)) {
    return 0;
  }

  return Math.max(0, Math.round((grossZatoshis * Math.max(0, serviceFeeBps)) / 10_000));
}

export function cipherPayStatusFromEvent(
  eventType: string | null,
  fallback: CipherPaySessionStatus = "unknown",
): CipherPaySessionStatus {
  const normalized = asString(eventType)?.toLowerCase();
  if (!normalized) return fallback;
  if (isCipherPayStatus(normalized)) return normalized;
  if (normalized === "invoice.created") return "draft";
  if (normalized === "invoice.pending") return "pending";
  if (normalized === "invoice.detected") return "detected";
  if (normalized === "invoice.confirmed") return "confirmed";
  if (normalized === "invoice.expired") return "expired";
  if (normalized === "invoice.refunded") return "refunded";
  if (normalized === "subscription.renewed") return "confirmed";
  if (normalized === "subscription.past_due") return "expired";
  if (normalized === "subscription.canceled") return "expired";
  return fallback;
}

export function applyDerivedCheckoutSessionState(
  session: CheckoutSession,
): CheckoutSession {
  if (!LOCALLY_EXPIRABLE_SESSION_STATUSES.has(session.status)) {
    return session;
  }

  if (!session.cipherpay_expires_at) {
    return session;
  }

  const expiresAt = new Date(session.cipherpay_expires_at).getTime();
  if (Number.isNaN(expiresAt) || expiresAt > Date.now()) {
    return session;
  }

  return {
    ...session,
    status: "expired",
  };
}

export function sortByIsoDateDesc<T>(items: T[], pickDate: (item: T) => string | null) {
  return [...items].sort((left, right) => {
    const leftMs = pickDate(left) ? new Date(pickDate(left) as string).getTime() : 0;
    const rightMs = pickDate(right) ? new Date(pickDate(right) as string).getTime() : 0;
    return rightMs - leftMs;
  });
}

export function addMinutes(isoTimestamp: string, minutes: number) {
  return new Date(new Date(isoTimestamp).getTime() + minutes * 60_000).toISOString();
}

export function taskRetryDelayMinutes(attemptCount: number) {
  const normalized = Math.max(1, Math.floor(attemptCount));
  return Math.min(240, 5 * 2 ** (normalized - 1));
}
