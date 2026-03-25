import { randomUUID } from "node:crypto";

type LogLevel = "info" | "warn" | "error";

function sanitizeFields(fields: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  );
}

export function createRequestId() {
  return randomUUID();
}

export function logEvent(
  level: LogLevel,
  event: string,
  fields: Record<string, unknown> = {},
) {
  const payload = sanitizeFields({
    ts: new Date().toISOString(),
    level,
    event,
    ...fields,
  });

  const serialized = JSON.stringify(payload);
  if (level === "error") {
    console.error(serialized);
    return;
  }

  if (level === "warn") {
    console.warn(serialized);
    return;
  }

  console.log(serialized);
}
