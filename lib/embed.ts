import { createHmac, timingSafeEqual } from "node:crypto";
import type { CalendarConnection, CalendarEmbedTheme } from "@/lib/app-state/types";

export const DEFAULT_EMBED_HEIGHT_PX = 860;
const MIN_EMBED_HEIGHT_PX = 480;
const MAX_EMBED_HEIGHT_PX = 2000;

function asTrimmedString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asInteger(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.floor(value);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function getEmbedSecret() {
  const candidates = [
    process.env.EMBED_SESSION_SECRET,
    process.env.SESSION_VIEWER_SECRET,
    process.env.TENANT_SESSION_SECRET,
    process.env.ADMIN_SESSION_SECRET,
  ];

  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return null;
}

function safeCompare(left: Buffer, right: Buffer) {
  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

function createEmbedParentSignature(payload: string, secret: string) {
  return createHmac("sha256", secret)
    .update(`embed-parent.${payload}`)
    .digest("base64url");
}

function parseHexPair(value: string) {
  return Number.parseInt(value, 16);
}

function asTimestampMs(value: string) {
  const timestampMs = new Date(value).getTime();
  return Number.isFinite(timestampMs) ? timestampMs : null;
}

export function normalizeOrigin(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed).origin.toLowerCase();
  } catch {
    return null;
  }
}

export function isUpcomingEvent(startAt: string, nowMs = Date.now()) {
  const timestampMs = asTimestampMs(startAt);
  return timestampMs != null && timestampMs >= nowMs;
}

export function selectUpcomingEvents<T extends { start_at: string }>(
  events: readonly T[],
  nowMs = Date.now(),
) {
  const upcomingEvents = events.filter((event) => isUpcomingEvent(event.start_at, nowMs));
  upcomingEvents.sort((left, right) => {
    const leftMs = asTimestampMs(left.start_at);
    const rightMs = asTimestampMs(right.start_at);
    if (leftMs == null && rightMs == null) {
      return 0;
    }

    if (leftMs == null) {
      return 1;
    }

    if (rightMs == null) {
      return -1;
    }

    return leftMs - rightMs;
  });
  return upcomingEvents;
}

export function normalizeOriginList(value: unknown) {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\n,]/g)
      : [];

  const normalized = values
    .map((entry) => (typeof entry === "string" ? normalizeOrigin(entry) : null))
    .filter(Boolean) as string[];

  return [...new Set(normalized)];
}

export function normalizeEmbedHexColor(value: unknown) {
  const raw = asTrimmedString(value);
  if (!raw) {
    return null;
  }

  const normalized = raw.startsWith("#") ? raw.slice(1) : raw;
  if (/^[0-9a-fA-F]{3}$/.test(normalized)) {
    return `#${normalized
      .split("")
      .map((segment) => `${segment}${segment}`)
      .join("")
      .toLowerCase()}`;
  }

  if (/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return `#${normalized.toLowerCase()}`;
  }

  return null;
}

export function normalizeEmbedHeight(
  value: unknown,
  fallback = DEFAULT_EMBED_HEIGHT_PX,
) {
  const parsed = asInteger(value);
  if (parsed == null) {
    return fallback;
  }

  return Math.min(MAX_EMBED_HEIGHT_PX, Math.max(MIN_EMBED_HEIGHT_PX, parsed));
}

export function normalizeCalendarEmbedTheme(value: unknown): CalendarEmbedTheme {
  const item = asRecord(value);
  const radius = asInteger(item?.radius_px);

  return {
    accent_color: normalizeEmbedHexColor(item?.accent_color),
    background_color: normalizeEmbedHexColor(item?.background_color),
    surface_color: normalizeEmbedHexColor(item?.surface_color),
    text_color: normalizeEmbedHexColor(item?.text_color),
    radius_px: radius != null ? Math.min(40, Math.max(8, radius)) : null,
  };
}

function hexToRgba(hexColor: string, alpha: number) {
  const normalized = normalizeEmbedHexColor(hexColor);
  if (!normalized) {
    return null;
  }

  const red = parseHexPair(normalized.slice(1, 3));
  const green = parseHexPair(normalized.slice(3, 5));
  const blue = parseHexPair(normalized.slice(5, 7));
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function buildEmbedThemeStyle(theme: CalendarEmbedTheme) {
  const style: Record<string, string> = {};

  if (theme.accent_color) {
    style["--accent"] = theme.accent_color;
    style["--accent-hover"] = theme.accent_color;
    style["--accent-bright"] = theme.accent_color;
    style["--accent-text"] = theme.accent_color;
    style["--accent-subtle"] =
      hexToRgba(theme.accent_color, 0.12) || theme.accent_color;
    style["--accent-glow"] =
      hexToRgba(theme.accent_color, 0.24) || theme.accent_color;
    style["--accent-border"] =
      hexToRgba(theme.accent_color, 0.28) || theme.accent_color;
  }

  if (theme.background_color) {
    style["--surface-page"] = theme.background_color;
  }

  if (theme.surface_color) {
    style["--surface-card"] = theme.surface_color;
    style["--surface-card-glass"] = theme.surface_color;
    style["--surface-card-solid"] = theme.surface_color;
    style["--surface-elevated"] = theme.surface_color;
  }

  if (theme.text_color) {
    style["--text-dark"] = theme.text_color;
    style["--color-gray-900"] = theme.text_color;
  }

  if (theme.radius_px != null) {
    style["--radius-lg"] = `${Math.max(10, theme.radius_px - 4)}px`;
    style["--radius-xl"] = `${theme.radius_px}px`;
    style["--radius-2xl"] = `${Math.max(theme.radius_px + 2, theme.radius_px)}px`;
    style["--radius-3xl"] = `${Math.max(theme.radius_px + 6, theme.radius_px)}px`;
  }

  return style;
}

export function isCalendarEmbedEnabled(calendar: CalendarConnection) {
  return calendar.embed_enabled && calendar.embed_allowed_origins.length > 0;
}

export function createEmbedParentToken(
  calendarConnectionId: string,
  parentOrigin: string,
) {
  const secret = getEmbedSecret();
  const normalizedOrigin = normalizeOrigin(parentOrigin);
  if (!secret || !normalizedOrigin) {
    return null;
  }

  const payload = Buffer.from(
    JSON.stringify({
      calendar_connection_id: calendarConnectionId,
      parent_origin: normalizedOrigin,
    }),
    "utf8",
  ).toString("base64url");
  const signature = createEmbedParentSignature(payload, secret);
  return `${payload}.${signature}`;
}

export function readEmbedParentOrigin(
  token: string | null | undefined,
  calendarConnectionId: string,
) {
  const secret = getEmbedSecret();
  const normalizedToken = token?.trim();
  if (!secret || !normalizedToken) {
    return null;
  }

  const [encodedPayload, signature] = normalizedToken.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expected = Buffer.from(
    createEmbedParentSignature(encodedPayload, secret),
    "base64url",
  );
  const actual = Buffer.from(signature, "base64url");
  if (!safeCompare(actual, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as { calendar_connection_id?: string; parent_origin?: string };

    if (payload.calendar_connection_id !== calendarConnectionId) {
      return null;
    }

    return normalizeOrigin(payload.parent_origin || null);
  } catch {
    return null;
  }
}

export function resolveEmbedParentOrigin(input: {
  calendarConnectionId: string;
  allowedOrigins: string[];
  requestHeaders: { get(name: string): string | null };
  parentToken?: string | null;
  parentOriginHint?: string | null;
}) {
  const normalizedAllowedOrigins = normalizeOriginList(input.allowedOrigins);
  if (normalizedAllowedOrigins.length === 0) {
    return null;
  }

  const tokenOrigin = readEmbedParentOrigin(
    input.parentToken,
    input.calendarConnectionId,
  );
  if (tokenOrigin && normalizedAllowedOrigins.includes(tokenOrigin)) {
    return tokenOrigin;
  }

  const refererOrigin = normalizeOrigin(input.requestHeaders.get("referer"));
  if (refererOrigin && normalizedAllowedOrigins.includes(refererOrigin)) {
    return refererOrigin;
  }

  const requestOrigin = normalizeOrigin(input.requestHeaders.get("origin"));
  if (requestOrigin && normalizedAllowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }

  return null;
}
