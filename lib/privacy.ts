function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

export function getEmailDomain(email: string | null | undefined) {
  if (!email) {
    return null;
  }

  const normalized = email.trim().toLowerCase();
  const atIndex = normalized.lastIndexOf("@");
  if (atIndex <= 0 || atIndex === normalized.length - 1) {
    return null;
  }

  return normalized.slice(atIndex + 1);
}

export function authAuditEmailMetadata(email: string | null | undefined) {
  const emailDomain = getEmailDomain(email);
  if (!emailDomain) {
    return {};
  }

  return {
    email_domain: emailDomain,
  };
}

export function summarizeAuthRequestHeaders(
  request: Request,
  options?: {
    includeOrigin?: boolean;
  },
) {
  const headers: Record<string, unknown> = {};

  if (options?.includeOrigin) {
    const origin = request.headers.get("origin");
    if (origin) {
      headers.origin = origin;
    }
  }

  return Object.keys(headers).length > 0 ? headers : null;
}

export function summarizeWebhookHeaders(headers: Record<string, unknown> | null | undefined) {
  const names = Array.from(
    new Set(
      Object.keys(headers || {})
        .map((name) => name.trim().toLowerCase())
        .filter(Boolean),
    ),
  ).sort();

  if (names.length === 0) {
    return null;
  }

  return {
    summary_version: 1,
    header_names: names,
  };
}

export function summarizeWebhookPayload(payload: Record<string, unknown> | null | undefined) {
  const record = asRecord(payload);
  if (!record) {
    return null;
  }

  const summary: Record<string, unknown> = {
    summary_version: 1,
    top_level_keys: Object.keys(record).sort(),
  };

  const nestedKeys = {
    data_keys: asRecord(record.data),
    invoice_keys: asRecord(record.invoice),
    metadata_keys: asRecord(record.metadata),
  };

  for (const [key, nested] of Object.entries(nestedKeys)) {
    if (nested) {
      summary[key] = Object.keys(nested).sort();
    }
  }

  if (typeof record.timestamp === "string") {
    summary.timestamp = record.timestamp;
  }

  return summary;
}
