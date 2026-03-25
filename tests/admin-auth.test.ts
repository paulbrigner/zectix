import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ADMIN_SESSION_TTL_SECONDS,
  createAdminPasswordHash,
  createAdminSessionToken,
  isAdminAuthEnabled,
  isAdminSessionTokenValid,
  verifyAdminPassword,
} from "@/lib/admin-auth";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("admin auth helpers", () => {
  it("hashes and verifies passwords with trimming", () => {
    const hash = createAdminPasswordHash("  correct horse battery staple  ");
    vi.stubEnv("ADMIN_PASSWORD_HASH", hash);

    expect(verifyAdminPassword("correct horse battery staple")).toBe(true);
    expect(verifyAdminPassword("wrong")).toBe(false);
  });

  it("rejects malformed stored hashes", () => {
    vi.stubEnv("ADMIN_PASSWORD_HASH", "not-a-valid-hash");

    expect(verifyAdminPassword("anything")).toBe(false);
  });

  it("creates and validates session tokens until expiration", () => {
    vi.stubEnv("ADMIN_SESSION_SECRET", "session-secret");
    vi.stubEnv("ADMIN_PASSWORD_HASH", createAdminPasswordHash("password"));

    const now = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    const token = createAdminSessionToken();

    expect(isAdminSessionTokenValid(token)).toBe(true);

    vi.spyOn(Date, "now").mockReturnValue(
      now + ADMIN_SESSION_TTL_SECONDS * 1000 + 1,
    );
    expect(isAdminSessionTokenValid(token)).toBe(false);
  });

  it("treats missing auth config as disabled", () => {
    vi.stubEnv("ADMIN_PASSWORD_HASH", "");
    vi.stubEnv("ADMIN_SESSION_SECRET", "");
    expect(isAdminAuthEnabled()).toBe(false);
  });
});
