import { createHmac, timingSafeEqual } from "node:crypto";
import { getSessionViewerSecret, isSessionViewerProtectionEnabled } from "@/lib/runtime-env";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function safeCompare(left: Buffer, right: Buffer) {
  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

function createSignature(sessionId: string, attendeeEmail: string, secret: string) {
  return createHmac("sha256", secret)
    .update(`session.${sessionId}.${normalizeEmail(attendeeEmail)}`)
    .digest("base64url");
}

export function createSessionViewerToken(sessionId: string, attendeeEmail: string) {
  const secret = getSessionViewerSecret();
  if (!secret) {
    return null;
  }

  return createSignature(sessionId, attendeeEmail, secret);
}

export function isSessionViewerTokenValid(
  sessionId: string,
  attendeeEmail: string,
  token: string | null | undefined,
) {
  if (!isSessionViewerProtectionEnabled()) {
    return true;
  }

  const normalizedToken = token?.trim();
  const secret = getSessionViewerSecret();
  if (!normalizedToken || !secret) {
    return false;
  }

  const expected = Buffer.from(
    createSignature(sessionId, attendeeEmail, secret),
    "base64url",
  );
  const actual = Buffer.from(normalizedToken, "base64url");
  return safeCompare(actual, expected);
}
