import { randomBytes, scryptSync } from "node:crypto";

const password = process.argv[2]?.trim();

if (!password) {
  console.error("Usage: node scripts/generate-admin-password-hash.mjs 'your-password'");
  process.exit(1);
}

const salt = randomBytes(16).toString("base64url");
const hash = scryptSync(password, salt, 32).toString("base64url");
const sessionSecret = randomBytes(32).toString("base64url");

console.log(`ADMIN_PASSWORD_HASH=scrypt:${salt}:${hash}`);
console.log(`ADMIN_SESSION_SECRET=${sessionSecret}`);

