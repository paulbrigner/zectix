import { beforeEach, describe, expect, it, vi } from "vitest";

const mockConsumeLumaIntegrationInterestRateLimit = vi.fn();
const mockParseLumaIntegrationInterestSubmission = vi.fn();
const mockGetLumaIntegrationInterestEmailConfig = vi.fn();
const mockBuildLumaIntegrationInterestEmail = vi.fn();
const mockGetTrustedIpAddress = vi.fn();
const mockSend = vi.fn();

vi.mock("@/lib/app-state/state", () => ({
  consumeLumaIntegrationInterestRateLimit: mockConsumeLumaIntegrationInterestRateLimit,
}));

vi.mock("@/lib/luma-integration-interest", () => ({
  parseLumaIntegrationInterestSubmission: mockParseLumaIntegrationInterestSubmission,
  getLumaIntegrationInterestEmailConfig: mockGetLumaIntegrationInterestEmailConfig,
  buildLumaIntegrationInterestEmail: mockBuildLumaIntegrationInterestEmail,
}));

vi.mock("@/lib/request-security", () => ({
  getTrustedIpAddress: mockGetTrustedIpAddress,
}));

vi.mock("@aws-sdk/client-sesv2", () => ({
  SESv2Client: class {
    send = mockSend;
  },
  SendEmailCommand: class {
    input: unknown;

    constructor(input: unknown) {
      this.input = input;
    }
  },
}));

const { POST } = await import("@/app/api/luma-integration-interest/route");

describe("luma integration interest route", () => {
  beforeEach(() => {
    mockConsumeLumaIntegrationInterestRateLimit.mockReset();
    mockParseLumaIntegrationInterestSubmission.mockReset();
    mockGetLumaIntegrationInterestEmailConfig.mockReset();
    mockBuildLumaIntegrationInterestEmail.mockReset();
    mockGetTrustedIpAddress.mockReset();
    mockSend.mockReset();

    mockGetTrustedIpAddress.mockReturnValue("203.0.113.10");
    mockConsumeLumaIntegrationInterestRateLimit.mockResolvedValue({
      ok: true,
      retry_after_seconds: null,
      reason: null,
    });
    mockParseLumaIntegrationInterestSubmission.mockReturnValue({
      ok: true,
      data: {
        fullName: "Paul Brigner",
        organization: "ZecTix",
        email: "paul@example.com",
        websiteOrLumaUrl: "https://zectix.com",
        eventVolume: "Still exploring",
        timeline: "Just researching",
        notes: "Interested in the beta flow.",
      },
    });
    mockGetLumaIntegrationInterestEmailConfig.mockReturnValue({
      fromEmail: "support@zectix.com",
      toEmail: "paul@paulbrigner.com",
    });
    mockBuildLumaIntegrationInterestEmail.mockReturnValue({
      subject: "subject",
      text: "text",
      html: "<p>html</p>",
    });
    mockSend.mockResolvedValue({});
  });

  it("blocks before SES when the IP rate limit is exceeded", async () => {
    mockConsumeLumaIntegrationInterestRateLimit.mockResolvedValueOnce({
      ok: false,
      retry_after_seconds: 600,
      reason:
        "Too many interest form submissions from this IP. Please wait a few minutes and try again.",
    });

    const request = new Request("https://zectix.com/api/luma-integration-interest", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        ignored: true,
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("600");
    await expect(response.json()).resolves.toEqual({
      error:
        "Too many interest form submissions from this IP. Please wait a few minutes and try again.",
    });
    expect(mockParseLumaIntegrationInterestSubmission).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("sends the inquiry email for valid, under-limit submissions", async () => {
    const request = new Request("https://zectix.com/api/luma-integration-interest", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        fullName: "Paul Brigner",
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mockConsumeLumaIntegrationInterestRateLimit).toHaveBeenCalledWith({
      ipAddress: "203.0.113.10",
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
  });
});
