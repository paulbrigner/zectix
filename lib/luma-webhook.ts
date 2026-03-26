import { createHmac, timingSafeEqual } from "node:crypto";
import { asRecord, asString } from "@/lib/app-state/utils";

export const LUMA_WEBHOOK_SIGNATURE_HEADERS = [
  "x-luma-signature",
  "luma-signature",
  "x-signature",
] as const;

function normalizeHexSignature(value: string | null | undefined) {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.replace(/^sha256=/, "");
  if (!normalized || normalized.length % 2 !== 0) {
    return null;
  }

  return /^[0-9a-f]+$/.test(normalized) ? normalized : null;
}

export function resolveLumaWebhookSignatureHeader(headers: Headers) {
  for (const name of LUMA_WEBHOOK_SIGNATURE_HEADERS) {
    const value = headers.get(name);
    if (value?.trim()) {
      return value.trim();
    }
  }

  return null;
}

export function resolveLumaWebhookSecretHeader(headers: Headers) {
  return (
    headers.get("x-luma-webhook-secret") ||
    headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    null
  );
}

export function computeLumaWebhookSignature({
  body,
  secret,
}: {
  body: string;
  secret: string | null | undefined;
}) {
  // Placeholder until Luma publishes the exact signing scheme for deliveries.
  return createHmac("sha256", String(secret || ""))
    .update(body, "utf8")
    .digest("hex");
}

export function verifyLumaWebhookSignature({
  body,
  signature,
  secret,
}: {
  body: string;
  signature: string | null | undefined;
  secret: string | null | undefined;
}) {
  if (!secret) {
    return { ok: false as const, reason: "missing_secret" };
  }

  if (!signature) {
    return { ok: false as const, reason: "missing_signature" };
  }

  const expected = normalizeHexSignature(
    computeLumaWebhookSignature({
      body,
      secret,
    }),
  );
  const actual = normalizeHexSignature(signature);

  if (!expected || !actual) {
    return { ok: false as const, reason: "invalid_signature_format" };
  }

  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(actual, "hex");
  if (
    expectedBuffer.length !== actualBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return { ok: false as const, reason: "signature_mismatch" };
  }

  return { ok: true as const };
}

export function extractLumaWebhookEventType(payload: unknown) {
  const body = asRecord(payload);
  return asString(body?.type) || asString(body?.event_type);
}

export function extractLumaWebhookEventApiId(payload: unknown) {
  const body = asRecord(payload);
  const data = asRecord(body?.data);
  return (
    asString(data?.id) ||
    asString(data?.event_api_id) ||
    asString(asRecord(data?.event)?.id)
  );
}
