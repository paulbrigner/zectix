import { describe, expect, it } from "vitest";
import {
  computeCipherPayWebhookSignature,
  verifyCipherPayWebhookSignature,
} from "@/lib/cipherpay-webhook";

  describe("CipherPay webhook signatures", () => {
  const timestamp = "2026-03-24T12:00:00.000Z";
  const body = '{"invoice_id":"invoice_123","event":"invoice.detected"}';
  const secret = "cipherpay-secret";

  it("accepts a valid signature", () => {
    const signature = computeCipherPayWebhookSignature({
      timestamp,
      body,
      secret,
    });

    expect(
      verifyCipherPayWebhookSignature({
        timestamp,
        signature,
        body,
        secret,
        nowMs: new Date(timestamp).getTime() + 1000,
      }),
    ).toMatchObject({ ok: true });
  });

  it("rejects stale timestamps, missing fields, and body mismatches", () => {
    const signature = computeCipherPayWebhookSignature({
      timestamp,
      body,
      secret,
    });

    expect(
      verifyCipherPayWebhookSignature({
        timestamp: null,
        signature,
        body,
        secret,
      }),
    ).toMatchObject({ ok: false, reason: "missing_timestamp" });

    expect(
      verifyCipherPayWebhookSignature({
        timestamp,
        signature: null,
        body,
        secret,
      }),
    ).toMatchObject({ ok: false, reason: "missing_signature" });

    expect(
      verifyCipherPayWebhookSignature({
        timestamp,
        signature,
        body,
        secret,
        nowMs: new Date(timestamp).getTime() + 10 * 60 * 1000 + 1,
      }),
    ).toMatchObject({ ok: false, reason: "timestamp_out_of_range" });

    expect(
      verifyCipherPayWebhookSignature({
        timestamp,
        signature,
        body: `${body} `,
        secret,
        nowMs: new Date(timestamp).getTime() + 1000,
      }),
    ).toMatchObject({ ok: false, reason: "signature_mismatch" });
  });
});
