import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildEmbedThemeStyle,
  createEmbedParentToken,
  normalizeCalendarEmbedTheme,
  normalizeOriginList,
  readEmbedParentOrigin,
  resolveEmbedParentOrigin,
} from "@/lib/embed";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("embed helpers", () => {
  it("normalizes origin lists and strips paths", () => {
    expect(
      normalizeOriginList(
        "https://events.example.com\nhttps://app.example.com/path,invalid",
      ),
    ).toEqual(["https://events.example.com", "https://app.example.com"]);
  });

  it("normalizes embed theme colors and radius", () => {
    expect(
      normalizeCalendarEmbedTheme({
        accent_color: "#F7931A",
        text_color: "131B2D",
        radius_px: "24",
      }),
    ).toEqual({
      accent_color: "#f7931a",
      background_color: null,
      surface_color: null,
      text_color: "#131b2d",
      radius_px: 24,
    });
  });

  it("creates and validates a parent-origin token", () => {
    vi.stubEnv("EMBED_SESSION_SECRET", "embed-secret");

    const token = createEmbedParentToken(
      "calendar_123",
      "https://events.example.com",
    );

    expect(
      readEmbedParentOrigin(token, "calendar_123"),
    ).toBe("https://events.example.com");
    expect(readEmbedParentOrigin(token, "calendar_other")).toBeNull();
  });

  it("resolves embed parent origin from a signed token before headers", () => {
    vi.stubEnv("EMBED_SESSION_SECRET", "embed-secret");

    const token = createEmbedParentToken(
      "calendar_123",
      "https://events.example.com",
    );

    const requestHeaders = new Headers({
      referer: "https://service.example.com/c/demo/events/event_123?embed=1",
    });

    expect(
      resolveEmbedParentOrigin({
        calendarConnectionId: "calendar_123",
        allowedOrigins: ["https://events.example.com"],
        requestHeaders,
        parentToken: token,
      }),
    ).toBe("https://events.example.com");
  });

  it("maps embed theme overrides into CSS variables", () => {
    const style = buildEmbedThemeStyle({
      accent_color: "#f7931a",
      background_color: "#fafaf9",
      surface_color: "#ffffff",
      text_color: "#131b2d",
      radius_px: 24,
    });

    expect(style["--accent"]).toBe("#f7931a");
    expect(style["--surface-page"]).toBe("#fafaf9");
    expect(style["--surface-card"]).toBe("#ffffff");
    expect(style["--color-gray-900"]).toBe("#131b2d");
    expect(style["--radius-xl"]).toBe("24px");
  });
});
