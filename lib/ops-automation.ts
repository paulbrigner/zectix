import { timingSafeEqual } from "node:crypto";

function asNonEmptyString(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function getOpsAutomationSecret() {
  return asNonEmptyString(process.env.OPS_AUTOMATION_SECRET);
}

export function isOpsAutomationEnabled() {
  return Boolean(getOpsAutomationSecret());
}

export function isValidOpsAutomationSecret(secret: string | null | undefined) {
  const expected = getOpsAutomationSecret();
  const provided = asNonEmptyString(secret);

  if (!expected || !provided) {
    return false;
  }

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}
