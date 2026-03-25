import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSessionViewerToken,
  isSessionViewerTokenValid,
} from "@/lib/session-viewer";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("session viewer tokens", () => {
  it("creates and validates tokens with the configured secret", () => {
    vi.stubEnv("SESSION_VIEWER_SECRET", "viewer-secret");

    const token = createSessionViewerToken("session_123", "Jordan@example.com");

    expect(token).toBeTruthy();
    expect(
      isSessionViewerTokenValid(
        "session_123",
        "jordan@example.com",
        token,
      ),
    ).toBe(true);
  });

  it("falls back to the admin secret in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_SESSION_SECRET", "admin-session-secret");

    const token = createSessionViewerToken("session_123", "Jordan@example.com");

    expect(token).toBeTruthy();
    expect(
      isSessionViewerTokenValid(
        "session_123",
        "jordan@example.com",
        token,
      ),
    ).toBe(true);
  });

  it("allows access when protection is disabled", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SESSION_VIEWER_SECRET", "");
    vi.stubEnv("ADMIN_SESSION_SECRET", "");
    expect(
      isSessionViewerTokenValid("session_123", "jordan@example.com", "junk"),
    ).toBe(true);
  });
});
