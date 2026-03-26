import { describe, expect, it } from "vitest";
import {
  computeLumaWebhookSignature,
  extractLumaWebhookEventApiId,
  extractLumaWebhookEventType,
  verifyLumaWebhookSignature,
} from "@/lib/luma-webhook";

describe("luma webhook helper", () => {
  it("verifies an HMAC signature against the raw request body", () => {
    const body = JSON.stringify({
      type: "event.updated",
      data: {
        id: "event_123",
      },
    });
    const secret = "super-secret";
    const signature = computeLumaWebhookSignature({
      body,
      secret,
    });

    expect(
      verifyLumaWebhookSignature({
        body,
        signature,
        secret,
      }),
    ).toEqual({ ok: true });
    expect(
      verifyLumaWebhookSignature({
        body,
        signature: `sha256=${signature}`,
        secret,
      }),
    ).toEqual({ ok: true });
  });

  it("rejects malformed or mismatched signatures", () => {
    expect(
      verifyLumaWebhookSignature({
        body: '{"type":"event.created"}',
        signature: "not-hex",
        secret: "super-secret",
      }),
    ).toEqual({ ok: false, reason: "invalid_signature_format" });

    expect(
      verifyLumaWebhookSignature({
        body: '{"type":"event.created"}',
        signature: "00",
        secret: "super-secret",
      }),
    ).toEqual({ ok: false, reason: "signature_mismatch" });
  });

  it("extracts event metadata from event-level webhook payloads", () => {
    const payload = {
      type: "event.canceled",
      data: {
        id: "event_123",
      },
    };

    expect(extractLumaWebhookEventType(payload)).toBe("event.canceled");
    expect(extractLumaWebhookEventApiId(payload)).toBe("event_123");
  });
});
