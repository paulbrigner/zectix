import { describe, expect, it } from "vitest";
import { jsonError, jsonOk, redirectToPath, safeRedirectPath } from "@/lib/http";

describe("http helpers", () => {
  it("builds success json responses", async () => {
    const response = jsonOk({ ok: true });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(
      "private, no-store, max-age=0, must-revalidate",
    );
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("builds error json responses", async () => {
    const response = jsonError("Forbidden", 403);

    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe(
      "private, no-store, max-age=0, must-revalidate",
    );
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" });
  });

  it("emits app-relative redirects without depending on request origin", () => {
    const response = redirectToPath("/ops/login?error=invalid_password");

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/ops/login?error=invalid_password");
    expect(response.headers.get("cache-control")).toBe(
      "private, no-store, max-age=0, must-revalidate",
    );
  });

  it("preserves an explicit cache policy when one is provided", async () => {
    const response = jsonOk(
      { ok: true },
      {
        headers: {
          "Cache-Control": "public, max-age=60",
        },
      },
    );

    expect(response.headers.get("cache-control")).toBe("public, max-age=60");
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("keeps redirect targets internal and within allowed prefixes", () => {
    expect(
      safeRedirectPath("/dashboard/help?sent=1", "/dashboard", {
        allowedPrefixes: ["/dashboard"],
      }),
    ).toBe("/dashboard/help?sent=1");
    expect(
      safeRedirectPath("https://evil.example/phish", "/dashboard", {
        allowedPrefixes: ["/dashboard"],
      }),
    ).toBe("/dashboard");
    expect(
      safeRedirectPath("//evil.example/phish", "/dashboard", {
        allowedPrefixes: ["/dashboard"],
      }),
    ).toBe("/dashboard");
    expect(
      safeRedirectPath("/ops/tenants", "/dashboard", {
        allowedPrefixes: ["/dashboard"],
      }),
    ).toBe("/dashboard");
  });
});
