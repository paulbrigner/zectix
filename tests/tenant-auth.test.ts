import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createTenantMagicLinkTokenHash,
  createTenantMagicLinkTokenValue,
  createTenantSessionToken,
  getTenantAuthFromEmail,
  isTenantEmailAuthEnabled,
  readTenantSessionEmail,
  TENANT_SESSION_TTL_SECONDS,
} from "@/lib/tenant-auth";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("tenant auth helpers", () => {
  it("uses explicit tenant auth config when present", () => {
    vi.stubEnv("TENANT_AUTH_FROM_EMAIL", "auth@zectix.com");
    vi.stubEnv("TENANT_SESSION_SECRET", "tenant-session-secret");
    vi.stubEnv("TENANT_MAGIC_LINK_SECRET", "tenant-magic-secret");

    expect(getTenantAuthFromEmail()).toBe("auth@zectix.com");
    expect(isTenantEmailAuthEnabled()).toBe(true);
  });

  it("falls back to the admin auth sender and secrets in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("TENANT_AUTH_FROM_EMAIL", "");
    vi.stubEnv("TENANT_SESSION_SECRET", "");
    vi.stubEnv("TENANT_MAGIC_LINK_SECRET", "");
    vi.stubEnv("ADMIN_AUTH_FROM_EMAIL", "auth@zectix.com");
    vi.stubEnv("ADMIN_SESSION_SECRET", "admin-session-secret");
    vi.stubEnv("ADMIN_MAGIC_LINK_SECRET", "admin-magic-secret");

    expect(getTenantAuthFromEmail()).toBe("auth@zectix.com");
    expect(isTenantEmailAuthEnabled()).toBe(true);
  });

  it("requires tenant signing secrets in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TENANT_AUTH_FROM_EMAIL", "");
    vi.stubEnv("TENANT_SESSION_SECRET", "");
    vi.stubEnv("TENANT_MAGIC_LINK_SECRET", "");
    vi.stubEnv("ADMIN_AUTH_FROM_EMAIL", "auth@zectix.com");
    vi.stubEnv("ADMIN_SESSION_SECRET", "admin-session-secret");
    vi.stubEnv("ADMIN_MAGIC_LINK_SECRET", "admin-magic-secret");

    expect(() => isTenantEmailAuthEnabled()).toThrow(
      "TENANT_SESSION_SECRET is required in production.",
    );
  });

  it("creates and validates tenant session tokens until expiration", () => {
    vi.stubEnv("TENANT_SESSION_SECRET", "tenant-session-secret");
    vi.stubEnv("TENANT_MAGIC_LINK_SECRET", "tenant-magic-secret");
    vi.stubEnv("TENANT_AUTH_FROM_EMAIL", "auth@zectix.com");

    const now = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    const token = createTenantSessionToken("contact@example.com");

    expect(readTenantSessionEmail(token)).toBe("contact@example.com");

    vi.spyOn(Date, "now").mockReturnValue(
      now + TENANT_SESSION_TTL_SECONDS * 1000 + 1,
    );
    expect(readTenantSessionEmail(token)).toBeNull();
  });

  it("creates stable tenant magic-link token hashes from one-time values", () => {
    vi.stubEnv("TENANT_MAGIC_LINK_SECRET", "tenant-magic-secret");

    const token = createTenantMagicLinkTokenValue();
    const firstHash = createTenantMagicLinkTokenHash(token);
    const secondHash = createTenantMagicLinkTokenHash(token);

    expect(token).not.toHaveLength(0);
    expect(firstHash).toBe(secondHash);
    expect(createTenantMagicLinkTokenHash("another-token")).not.toBe(firstHash);
  });
});
