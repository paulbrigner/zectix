function trim(value) {
  return typeof value === "string" ? value.trim() : "";
}

function requireValue(name, value) {
  const normalized = trim(value);
  if (!normalized) {
    throw new Error(`${name} is required.`);
  }
  return normalized;
}

function normalizeBaseUrl(baseUrl) {
  const normalized = requireValue("ZECTIX_BASE_URL", baseUrl);
  return normalized.endsWith("/") ? normalized : `${normalized}/`;
}

function joinUrl(baseUrl, path) {
  return new URL(path.replace(/^\//, ""), normalizeBaseUrl(baseUrl)).toString();
}

async function readBody(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text || null;
  }
}

export async function handler(event = {}) {
  const baseUrl = normalizeBaseUrl(process.env.ZECTIX_BASE_URL);
  const automationSecret = requireValue(
    "OPS_AUTOMATION_SECRET",
    process.env.OPS_AUTOMATION_SECRET,
  );

  const sessionId =
    event && typeof event === "object" && typeof event.session_id === "string"
      ? event.session_id.trim()
      : "";

  const response = await fetch(joinUrl(baseUrl, "/api/admin/retry-registration"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "x-zectix-automation-secret": automationSecret,
      "x-ops-source": "aws-eventbridge",
    },
    body: JSON.stringify(sessionId ? { session_id: sessionId } : {}),
  });

  const body = await readBody(response);
  if (!response.ok) {
    throw new Error(
      `Retry registrations failed (${response.status}): ${JSON.stringify(body)}`,
    );
  }

  return {
    ok: true,
    base_url: baseUrl.replace(/\/$/, ""),
    mode: sessionId ? "single-session" : "due-sessions",
    session_id: sessionId || null,
    result: body,
  };
}
