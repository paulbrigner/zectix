import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

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

function asPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(trim(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeBaseUrl(baseUrl) {
  const normalized = requireValue("Production base URL", baseUrl);
  return normalized.endsWith("/") ? normalized : `${normalized}/`;
}

function joinUrl(baseUrl, path) {
  return new URL(path.replace(/^\//, ""), normalizeBaseUrl(baseUrl)).toString();
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      headers: {
        accept: "application/json, text/html;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function readBody(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text || null;
  }
}

async function assertOk({ label, url, timeoutMs, validate }) {
  const response = await fetchWithTimeout(url, timeoutMs);
  const body = await readBody(response);

  if (!response.ok) {
    throw new Error(`${label} failed (${response.status}): ${JSON.stringify(body)}`);
  }

  if (validate) {
    validate(body);
  }

  return {
    label,
    status: response.status,
    body,
  };
}

function validateHealth(body) {
  if (!body || typeof body !== "object" || body.ok !== true) {
    throw new Error(`Health response was not ok: ${JSON.stringify(body)}`);
  }
}

function validateReady(body) {
  if (!body || typeof body !== "object" || body.ok !== true) {
    throw new Error(`Readiness response was not ok: ${JSON.stringify(body)}`);
  }
}

async function runSmokeCheck(baseUrl, timeoutMs) {
  return Promise.all([
    assertOk({
      label: "home",
      url: joinUrl(baseUrl, "/"),
      timeoutMs,
    }),
    assertOk({
      label: "health",
      url: joinUrl(baseUrl, "/api/health"),
      timeoutMs,
      validate: validateHealth,
    }),
    assertOk({
      label: "ready",
      url: joinUrl(baseUrl, "/api/ready"),
      timeoutMs,
      validate: validateReady,
    }),
  ]);
}

async function main() {
  const baseUrl = normalizeBaseUrl(process.env.PRODUCTION_BASE_URL);
  const maxAttempts = asPositiveInteger(process.env.SMOKE_MAX_ATTEMPTS, 3);
  const retryDelaySeconds = asPositiveInteger(
    process.env.SMOKE_RETRY_DELAY_SECONDS,
    10,
  );
  const requestTimeoutSeconds = asPositiveInteger(
    process.env.SMOKE_REQUEST_TIMEOUT_SECONDS,
    15,
  );
  const timeoutMs = requestTimeoutSeconds * 1000;

  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const results = await runSmokeCheck(baseUrl, timeoutMs);
      console.log(
        JSON.stringify(
          {
            ok: true,
            base_url: baseUrl.replace(/\/$/, ""),
            attempts: attempt,
            results,
          },
          null,
          2,
        ),
      );
      return;
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await delay(retryDelaySeconds * 1000);
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Production smoke check failed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
