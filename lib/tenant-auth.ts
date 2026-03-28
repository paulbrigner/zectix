import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getAdminAuthFromEmail } from "@/lib/admin-auth";
import { normalizeEmailAddress } from "@/lib/app-state/utils";

export const TENANT_SESSION_COOKIE = "zectix_tenant";
export const TENANT_SESSION_TTL_SECONDS = 60 * 60 * 12;
export const TENANT_MAGIC_LINK_TTL_SECONDS = 60 * 15;

function asNonEmptyString(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function safeCompare(left: Buffer, right: Buffer) {
  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

function getTenantSessionSecret() {
  return (
    asNonEmptyString(process.env.TENANT_SESSION_SECRET) ||
    asNonEmptyString(process.env.ADMIN_SESSION_SECRET)
  );
}

function getTenantMagicLinkSecret() {
  return (
    asNonEmptyString(process.env.TENANT_MAGIC_LINK_SECRET) ||
    asNonEmptyString(process.env.ADMIN_MAGIC_LINK_SECRET)
  );
}

export function getTenantAuthFromEmail() {
  return asNonEmptyString(process.env.TENANT_AUTH_FROM_EMAIL) || getAdminAuthFromEmail();
}

export function isTenantEmailAuthEnabled() {
  return Boolean(
    getTenantAuthFromEmail() && getTenantSessionSecret() && getTenantMagicLinkSecret(),
  );
}

function encodeEmail(email: string) {
  return Buffer.from(normalizeEmailAddress(email), "utf8").toString("base64url");
}

function decodeEmail(value: string) {
  try {
    return normalizeEmailAddress(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    return "";
  }
}

function createTenantSessionSignature(email: string, expiresAt: string, secret: string) {
  return createHmac("sha256", secret)
    .update(`tenant.${normalizeEmailAddress(email)}.${expiresAt}`)
    .digest("base64url");
}

export function createTenantSessionToken(email: string) {
  const secret = getTenantSessionSecret();
  const normalizedEmail = normalizeEmailAddress(email);
  if (!secret || !normalizedEmail) {
    throw new Error("Tenant auth is not fully configured.");
  }

  const expiresAt = String(Math.floor(Date.now() / 1000) + TENANT_SESSION_TTL_SECONDS);
  const signature = createTenantSessionSignature(normalizedEmail, expiresAt, secret);
  return `${encodeEmail(normalizedEmail)}.${expiresAt}.${signature}`;
}

export function readTenantSessionEmail(token: string | null | undefined) {
  if (!isTenantEmailAuthEnabled()) {
    return null;
  }

  const secret = getTenantSessionSecret();
  const normalizedToken = asNonEmptyString(token);
  if (!secret || !normalizedToken) {
    return null;
  }

  const [encodedEmail, expiresAt, signature] = normalizedToken.split(".");
  if (!encodedEmail || !expiresAt || !signature) {
    return null;
  }

  const expiresAtSeconds = Number.parseInt(expiresAt, 10);
  if (!Number.isFinite(expiresAtSeconds)) {
    return null;
  }

  if (expiresAtSeconds <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  const email = decodeEmail(encodedEmail);
  if (!email) {
    return null;
  }

  const expected = Buffer.from(
    createTenantSessionSignature(email, expiresAt, secret),
    "base64url",
  );
  const actual = Buffer.from(signature, "base64url");
  return safeCompare(actual, expected) ? email : null;
}

export function createTenantMagicLinkTokenValue() {
  const secret = getTenantMagicLinkSecret();
  if (!secret) {
    throw new Error("Tenant magic-link auth is not fully configured.");
  }

  return randomBytes(24).toString("base64url");
}

export function createTenantMagicLinkTokenHash(token: string) {
  const secret = getTenantMagicLinkSecret();
  const normalizedToken = asNonEmptyString(token);
  if (!secret || !normalizedToken) {
    throw new Error("Tenant magic-link auth is not fully configured.");
  }

  return createHmac("sha256", secret)
    .update(`tenant-link.${normalizedToken}`)
    .digest("hex");
}
