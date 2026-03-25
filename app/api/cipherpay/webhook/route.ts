import { verifyCipherPayWebhookSignature } from "@/lib/cipherpay-webhook";
import { jsonError, jsonOk } from "@/lib/http";
import { processCipherPayWebhook } from "@/lib/app-state/service";
import { getRuntimeConfig } from "@/lib/app-state/state";
import { asRecord, asString } from "@/lib/app-state/utils";
import { createRequestId, logEvent } from "@/lib/observability";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = createRequestId();
  const config = await getRuntimeConfig({ allowMissingTable: true });
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

  const timestampHeader = request.headers.get("x-cipherpay-timestamp");
  const signature = request.headers.get("x-cipherpay-signature");
  const verification = verifyCipherPayWebhookSignature({
    timestamp: timestampHeader,
    signature,
    body: rawBody,
    secret: config.webhook_secret,
  });

  const requestBodyJson = asRecord(payload) || { raw_body: rawBody };
  const invoiceId = asString(asRecord(payload)?.invoice_id);
  const eventType = asString(asRecord(payload)?.event);
  const txid = asString(asRecord(payload)?.txid);

  await processCipherPayWebhook({
    requestBody: requestBodyJson,
    eventType,
    invoiceId,
    signatureValid: verification.ok,
    validationError: verification.ok ? null : verification.reason || "invalid_signature",
    requestHeaders: {
      "x-cipherpay-signature": signature,
      "x-cipherpay-timestamp": timestampHeader,
      "user-agent": request.headers.get("user-agent"),
      "x-forwarded-for": request.headers.get("x-forwarded-for"),
    },
    timestampHeader,
    txid,
  });

  if (!config.webhook_secret) {
    logEvent("error", "webhook.rejected_missing_secret", {
      request_id: requestId,
      invoice_id: invoiceId,
      event_type: eventType,
    });
    return jsonError("CipherPay webhook secret is not configured", 503);
  }

  if (!verification.ok) {
    logEvent("warn", "webhook.rejected_invalid_signature", {
      request_id: requestId,
      invoice_id: invoiceId,
      event_type: eventType,
      reason: verification.reason,
    });
    return jsonError("Invalid CipherPay webhook signature", 401);
  }

  if (!asRecord(payload)) {
    logEvent("warn", "webhook.rejected_invalid_json", {
      request_id: requestId,
    });
    return jsonError("Invalid JSON body");
  }

  logEvent("info", "webhook.accepted", {
    request_id: requestId,
    invoice_id: invoiceId,
    event_type: eventType,
  });

  return jsonOk({ received: true });
}
