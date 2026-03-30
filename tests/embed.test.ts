import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildEmbedThemeStyle,
  createEmbedParentToken,
  normalizeCalendarEmbedTheme,
  normalizeOriginList,
  readEmbedParentOrigin,
  resolveEmbedParentOrigin,
  selectUpcomingEvents,
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

  it("does not trust an unsigned parent-origin hint by itself", () => {
    expect(
      resolveEmbedParentOrigin({
        calendarConnectionId: "calendar_123",
        allowedOrigins: ["https://events.example.com"],
        requestHeaders: new Headers(),
        parentOriginHint: "https://events.example.com",
      }),
    ).toBeNull();
  });

  it("resolves embed parent origin from an allowed referer", () => {
    expect(
      resolveEmbedParentOrigin({
        calendarConnectionId: "calendar_123",
        allowedOrigins: ["https://events.example.com"],
        requestHeaders: new Headers({
          referer: "https://events.example.com/embed/calendar",
        }),
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

  it("returns all upcoming events in start order for embed snippets", () => {
    expect(
      selectUpcomingEvents(
        [
          { event_api_id: "evt-june", start_at: "2026-06-02T01:30:00.000Z" },
          { event_api_id: "evt-past", start_at: "2026-03-01T13:00:00.000Z" },
          { event_api_id: "evt-may", start_at: "2026-05-01T13:00:00.000Z" },
          { event_api_id: "evt-april", start_at: "2026-04-01T13:00:00.000Z" },
        ],
        Date.parse("2026-03-28T00:00:00.000Z"),
      ).map((event) => event.event_api_id),
    ).toEqual(["evt-april", "evt-may", "evt-june"]);
  });
});
