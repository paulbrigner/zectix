import { verifyCipherPayWebhookSignature } from "@/lib/cipherpay-webhook";
import {
  processCipherPayWebhook,
  resolveCipherPayWebhookContext,
} from "@/lib/app-state/service";
import { asRecord, asString } from "@/lib/app-state/utils";
import { jsonError, jsonOk } from "@/lib/http";
import { createRequestId, logEvent } from "@/lib/observability";

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

  const requestBodyJson = asRecord(payload) || { raw_body: rawBody };
  const invoiceId = asString(asRecord(payload)?.invoice_id);
  const eventType = asString(asRecord(payload)?.event);
  const txid = asString(asRecord(payload)?.txid);
  const timestampHeader = request.headers.get("x-cipherpay-timestamp");
  const signature = request.headers.get("x-cipherpay-signature");
  const context = await resolveCipherPayWebhookContext(invoiceId);

  const verification = verifyCipherPayWebhookSignature({
    timestamp: timestampHeader,
    signature,
    body: rawBody,
    secret: context.secret,
  });

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
    txid,
  });

  if (!verification.ok) {
    logEvent("warn", "webhook.rejected_invalid_signature", {
      request_id: requestId,
      invoice_id: invoiceId,
      event_type: eventType,
      reason: verification.reason,
    });
    return jsonError("Invalid CipherPay webhook signature", 401);
  }

  logEvent("info", "webhook.accepted", {
    request_id: requestId,
    invoice_id: invoiceId,
    event_type: eventType,
  });

  return jsonOk({ received: true });
}
