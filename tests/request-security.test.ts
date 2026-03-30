import { describe, expect, it } from "vitest";
import { getTrustedIpAddress } from "@/lib/request-security";

describe("request security helpers", () => {
  it("prefers x-real-ip when present", () => {
    const request = new Request("https://example.com", {
      headers: {
        "x-real-ip": "198.51.100.10",
        "x-forwarded-for": "203.0.113.5, 198.51.100.200",
      },
    });

    expect(getTrustedIpAddress(request)).toBe("198.51.100.10");
  });

  it("uses the first forwarded IP as the client address", () => {
    const request = new Request("https://example.com", {
      headers: {
        "x-forwarded-for": "203.0.113.5, 198.51.100.200, 198.51.100.201",
      },
    });

    expect(getTrustedIpAddress(request)).toBe("203.0.113.5");
  });
});
