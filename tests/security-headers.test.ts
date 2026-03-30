import { describe, expect, it } from "vitest";
import { buildSecurityHeaders } from "@/lib/security-headers";

describe("security headers", () => {
  it("adds framing protections for non-embed pages", () => {
    const headers = buildSecurityHeaders({
      pathname: "/dashboard/login",
      searchParams: new URLSearchParams(),
      isProduction: true,
    });

    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Content-Security-Policy")).toContain(
      "frame-ancestors 'none'",
    );
    expect(headers.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(headers.get("Strict-Transport-Security")).toBe(
      "max-age=31536000; includeSubDomains",
    );
  });

  it("omits frame denial for explicit embed pages", () => {
    const headers = buildSecurityHeaders({
      pathname: "/c/demo-calendar",
      searchParams: new URLSearchParams({ embed: "1" }),
      isProduction: true,
    });

    expect(headers.get("X-Frame-Options")).toBeNull();
    expect(headers.get("Content-Security-Policy")).toBe(
      "upgrade-insecure-requests",
    );
  });
});
