import { describe, expect, it } from "vitest";
import { jsonError, jsonOk, redirectToPath } from "@/lib/http";

describe("http helpers", () => {
  it("builds success json responses", async () => {
    const response = jsonOk({ ok: true });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("builds error json responses", async () => {
    const response = jsonError("Forbidden", 403);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" });
  });

  it("emits app-relative redirects without depending on request origin", () => {
    const response = redirectToPath("/ops/login?error=invalid_password");

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/ops/login?error=invalid_password");
  });
});
