import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "lumazcash_admin";
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 12;

function asNonEmptyString(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseStoredHash(value: string | null | undefined) {
  const stored = asNonEmptyString(value);
  if (!stored) {
    return null;
  }

  const [algorithm, salt, digest] = stored.split(":");
  if (algorithm !== "scrypt" || !salt || !digest) {
    return null;
  }

  return { algorithm, salt, digest };
}

function safeCompare(left: Buffer, right: Buffer) {
  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

export function isAdminAuthEnabled() {
  return Boolean(
    asNonEmptyString(process.env.ADMIN_PASSWORD_HASH) &&
      asNonEmptyString(process.env.ADMIN_SESSION_SECRET),
  );
}

export function createAdminPasswordHash(password: string) {
  const normalizedPassword = password.trim();
  if (!normalizedPassword) {
    throw new Error("Password is required.");
  }

  const salt = randomBytes(16).toString("base64url");
  const digest = scryptSync(normalizedPassword, salt, 32).toString("base64url");
  return `scrypt:${salt}:${digest}`;
}

export function verifyAdminPassword(password: string) {
  const parsed = parseStoredHash(process.env.ADMIN_PASSWORD_HASH);
  if (!parsed) {
    return false;
  }

  const normalizedPassword = password.trim();
  if (!normalizedPassword) {
    return false;
  }

  const expected = Buffer.from(parsed.digest, "base64url");
  const actual = scryptSync(normalizedPassword, parsed.salt, expected.length);
  return safeCompare(actual, expected);
}

function createAdminSessionSignature(expiresAt: string, secret: string) {
  return createHmac("sha256", secret)
    .update(`admin.${expiresAt}`)
    .digest("base64url");
}

export function createAdminSessionToken() {
  const secret = asNonEmptyString(process.env.ADMIN_SESSION_SECRET);
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET is required.");
  }

  const expiresAt = String(
    Math.floor(Date.now() / 1000) + ADMIN_SESSION_TTL_SECONDS,
  );
  const signature = createAdminSessionSignature(expiresAt, secret);
  return `${expiresAt}.${signature}`;
}

export function isAdminSessionTokenValid(token: string | null | undefined) {
  if (!isAdminAuthEnabled()) {
    return true;
  }

  const secret = asNonEmptyString(process.env.ADMIN_SESSION_SECRET);
  const normalizedToken = asNonEmptyString(token);
  if (!secret || !normalizedToken) {
    return false;
  }

  const [expiresAt, signature] = normalizedToken.split(".");
  if (!expiresAt || !signature) {
    return false;
  }

  const expiresAtSeconds = Number.parseInt(expiresAt, 10);
  if (!Number.isFinite(expiresAtSeconds)) {
    return false;
  }

  if (expiresAtSeconds <= Math.floor(Date.now() / 1000)) {
    return false;
  }

  const expected = Buffer.from(
    createAdminSessionSignature(expiresAt, secret),
    "base64url",
  );
  const actual = Buffer.from(signature, "base64url");
  return safeCompare(actual, expected);
}

