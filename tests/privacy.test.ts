import { describe, expect, it } from "vitest";
import {
  authAuditEmailMetadata,
  getEmailDomain,
  summarizeAuthRequestHeaders,
  summarizeWebhookHeaders,
  summarizeWebhookPayload,
} from "@/lib/privacy";

describe("privacy helpers", () => {
  it("keeps only the email domain for auth audit metadata", () => {
    expect(getEmailDomain("Jordan@example.com")).toBe("example.com");
    expect(authAuditEmailMetadata("Jordan@example.com")).toEqual({
      email_domain: "example.com",
    });
    expect(authAuditEmailMetadata("invalid")).toEqual({});
  });

  it("keeps only the origin header for auth audit request summaries", () => {
    const request = new Request("https://zectix.com/dashboard/login", {
      headers: {
        origin: "https://zectix.com",
        referer: "https://zectix.com/dashboard/start",
        "user-agent": "Example Browser",
      },
    });

    expect(
      summarizeAuthRequestHeaders(request, {
        includeOrigin: true,
      }),
    ).toEqual({
      origin: "https://zectix.com",
    });
  });

  it("stores webhook headers as header names only", () => {
    expect(
      summarizeWebhookHeaders({
        "X-CipherPay-Signature": "secret",
        "User-Agent": "CipherPay/1.0",
      }),
    ).toEqual({
      summary_version: 1,
      header_names: ["user-agent", "x-cipherpay-signature"],
    });
  });

  it("stores webhook payloads as structural summaries", () => {
    expect(
      summarizeWebhookPayload({
        timestamp: "2026-03-31T10:00:00.000Z",
        data: {
          id: "event_123",
          email: "attendee@example.com",
        },
        invoice: {
          invoice_id: "invoice_123",
        },
        event: "invoice.confirmed",
      }),
    ).toEqual({
      summary_version: 1,
      top_level_keys: ["data", "event", "invoice", "timestamp"],
      data_keys: ["email", "id"],
      invoice_keys: ["invoice_id"],
      timestamp: "2026-03-31T10:00:00.000Z",
    });
  });
});
