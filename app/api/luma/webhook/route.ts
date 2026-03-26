import { processLumaWebhook } from "@/lib/app-state/service";
import { getCalendarConnection } from "@/lib/app-state/state";
import { asRecord, asString } from "@/lib/app-state/utils";
import {
  extractLumaWebhookEventType,
  resolveLumaWebhookSecretHeader,
  resolveLumaWebhookSignatureHeader,
  verifyLumaWebhookSignature,
} from "@/lib/luma-webhook";
import { jsonError, jsonOk } from "@/lib/http";
import { createRequestId, logEvent } from "@/lib/observability";
import { getSecretStore } from "@/lib/secrets";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = createRequestId();
  const rawBody = await request.text();
  if (!rawBody) {
    return jsonError("Invalid JSON body");
  }

  let payload: unknown = null;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    payload = null;
  }

  const body = asRecord(payload);
  if (!body) {
    return jsonError("Invalid JSON body");
  }

  const calendarConnectionId =
    asString(new URL(request.url).searchParams.get("calendar_connection_id")) ||
    asString(body.calendar_connection_id);
  if (!calendarConnectionId) {
    return jsonError("calendar_connection_id is required", 400);
  }

  const connection = await getCalendarConnection(calendarConnectionId);
  if (!connection) {
    return jsonError("Calendar connection not found.", 404);
  }

  const webhookSecret = connection.luma_webhook_secret_ref
    ? await getSecretStore().getSecret(connection.luma_webhook_secret_ref)
    : null;
  if (!webhookSecret) {
    return jsonError("Luma webhook secret is not configured", 503);
  }

  const eventType = extractLumaWebhookEventType(body);
  const signatureHeader = resolveLumaWebhookSignatureHeader(request.headers);
  const legacySecretHeader = resolveLumaWebhookSecretHeader(request.headers);
  const signatureVerification = verifyLumaWebhookSignature({
    body: rawBody,
    signature: signatureHeader,
    secret: webhookSecret,
  });
  const signatureValid =
    signatureVerification.ok || legacySecretHeader === webhookSecret;
  const validationError = signatureValid
    ? null
    : signatureHeader
      ? signatureVerification.reason || "signature_mismatch"
      : legacySecretHeader
        ? "legacy_secret_mismatch"
        : "missing_signature";

  const result = await processLumaWebhook({
    calendarConnectionId: connection.calendar_connection_id,
    tenantId: connection.tenant_id,
    requestBody: body,
    eventType,
    signatureValid,
    validationError,
    requestHeaders: {
      "x-luma-signature": request.headers.get("x-luma-signature"),
      "luma-signature": request.headers.get("luma-signature"),
      "x-signature": request.headers.get("x-signature"),
      "x-luma-webhook-secret": request.headers.get("x-luma-webhook-secret"),
      authorization: request.headers.get("authorization"),
      "user-agent": request.headers.get("user-agent"),
      "x-forwarded-for": request.headers.get("x-forwarded-for"),
    },
  });

  if (!signatureValid) {
    logEvent("warn", "luma.webhook.rejected_invalid_signature", {
      request_id: requestId,
      calendar_connection_id: connection.calendar_connection_id,
      tenant_id: connection.tenant_id,
      event_type: eventType,
      reason: validationError,
    });
    return jsonError("Invalid Luma webhook signature", 401);
  }

  logEvent("info", "luma.webhook.accepted", {
    request_id: requestId,
    calendar_connection_id: connection.calendar_connection_id,
    tenant_id: connection.tenant_id,
    event_type: eventType,
    applied: result.applied,
    ignored: result.ignored,
  });

  return jsonOk({
    received: true,
    event_type: eventType,
    ...result,
  });
}
