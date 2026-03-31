import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateCheckoutSession = vi.fn();
const mockConsumeCheckoutRateLimit = vi.fn();
const mockGetPublicCalendar = vi.fn();
const mockGetTrustedIpAddress = vi.fn();
const mockCreateSessionViewerToken = vi.fn();
const mockLogEvent = vi.fn();

vi.mock("@/lib/app-state/service", () => ({
  createCheckoutSession: mockCreateCheckoutSession,
}));

vi.mock("@/lib/app-state/state", () => ({
  consumeCheckoutRateLimit: mockConsumeCheckoutRateLimit,
}));

vi.mock("@/lib/public/public-calendars", () => ({
  getPublicCalendar: mockGetPublicCalendar,
}));

vi.mock("@/lib/request-security", () => ({
  getTrustedIpAddress: mockGetTrustedIpAddress,
}));

vi.mock("@/lib/session-viewer", () => ({
  createSessionViewerToken: mockCreateSessionViewerToken,
}));

vi.mock("@/lib/observability", () => ({
  createRequestId: () => "req_123",
  logEvent: mockLogEvent,
}));

const { POST } = await import("@/app/api/checkout/route");

describe("checkout route", () => {
  beforeEach(() => {
    mockCreateCheckoutSession.mockReset();
    mockConsumeCheckoutRateLimit.mockReset();
    mockGetPublicCalendar.mockReset();
    mockGetTrustedIpAddress.mockReset();
    mockCreateSessionViewerToken.mockReset();
    mockLogEvent.mockReset();

    mockGetTrustedIpAddress.mockReturnValue("203.0.113.10");
    mockGetPublicCalendar.mockResolvedValue({
      tenant: {
        tenant_id: "tenant_123",
      },
    });
    mockConsumeCheckoutRateLimit.mockResolvedValue({
      ok: true,
    });
  });

  it("returns a generic 500 while logging the internal checkout failure", async () => {
    mockCreateCheckoutSession.mockRejectedValueOnce(
      new Error("DynamoDB ConditionalCheckFailedException: session lookup mismatch"),
    );

    const request = new Request("https://zectix.com/api/checkout", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        attendee_email: "jordan@example.com",
        attendee_name: "Jordan Lee",
        calendar_slug: "demo-calendar",
        event_api_id: "event_123",
        ticket_type_api_id: "ticket_123",
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Something went wrong. Please try again.",
    });
    expect(mockLogEvent).toHaveBeenCalledWith(
      "error",
      "checkout.request.failed",
      expect.objectContaining({
        request_id: "req_123",
        calendar_slug: "demo-calendar",
        event_api_id: "event_123",
        error: "DynamoDB ConditionalCheckFailedException: session lookup mismatch",
      }),
    );
    expect(mockLogEvent).not.toHaveBeenCalledWith(
      "error",
      "checkout.request.failed",
      expect.objectContaining({
        actor_ip: expect.anything(),
      }),
    );
    expect(mockLogEvent).not.toHaveBeenCalledWith(
      "error",
      "checkout.request.failed",
      expect.objectContaining({
        attendee_email: expect.anything(),
      }),
    );
  });

  it("rate-limits checkout requests without logging attendee email and ip together", async () => {
    mockConsumeCheckoutRateLimit.mockResolvedValueOnce({
      ok: false,
      reason: "Too many checkout attempts.",
      retry_after_seconds: 600,
    });

    const request = new Request("https://zectix.com/api/checkout", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        attendee_email: "jordan@example.com",
        attendee_name: "Jordan Lee",
        calendar_slug: "demo-calendar",
        event_api_id: "event_123",
        ticket_type_api_id: "ticket_123",
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("600");
    await expect(response.json()).resolves.toEqual({
      error: "Too many checkout attempts.",
    });
    expect(mockLogEvent).toHaveBeenCalledWith(
      "warn",
      "checkout.rate_limited",
      expect.objectContaining({
        request_id: "req_123",
        tenant_id: "tenant_123",
        event_api_id: "event_123",
        calendar_slug: "demo-calendar",
      }),
    );
    expect(mockLogEvent).not.toHaveBeenCalledWith(
      "warn",
      "checkout.rate_limited",
      expect.objectContaining({
        actor_ip: expect.anything(),
      }),
    );
    expect(mockLogEvent).not.toHaveBeenCalledWith(
      "warn",
      "checkout.rate_limited",
      expect.objectContaining({
        attendee_email: expect.anything(),
      }),
    );
  });
});
