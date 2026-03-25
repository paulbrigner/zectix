import process from "node:process";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) {
      continue;
    }

    const [name, inlineValue] = value.slice(2).split("=", 2);
    if (inlineValue !== undefined) {
      args[name] = inlineValue;
      continue;
    }

    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args[name] = next;
      index += 1;
    } else {
      args[name] = "true";
    }
  }
  return args;
}

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
  const normalized = requireValue("Base URL", baseUrl);
  return normalized.endsWith("/") ? normalized : `${normalized}/`;
}

function joinUrl(baseUrl, path) {
  return new URL(path.replace(/^\//, ""), normalizeBaseUrl(baseUrl)).toString();
}

function getOrigin(baseUrl) {
  return new URL(requireValue("Base URL", baseUrl)).origin;
}

function cookieHeaderFromSetCookie(setCookie) {
  if (!setCookie) {
    return null;
  }

  const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  const cookie = raw?.split(";")[0]?.trim();
  return cookie || null;
}

async function readBody(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text || null;
  }
}

async function postJson(url, body, headers = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });

  return {
    response,
    body: await readBody(response),
  };
}

function buildCommonHeaders(baseUrl, extraHeaders = {}) {
  const origin = getOrigin(baseUrl);
  return {
    origin,
    referer: joinUrl(baseUrl, "/admin-login"),
    ...extraHeaders,
  };
}

async function login(baseUrl, password) {
  const url = joinUrl(baseUrl, "/api/admin/login");
  const { response, body } = await postJson(
    url,
    { password },
    buildCommonHeaders(baseUrl),
  );

  if (!response.ok) {
    throw new Error(
      `Admin login failed (${response.status}): ${JSON.stringify(body)}`,
    );
  }

  const cookie = cookieHeaderFromSetCookie(response.headers.get("set-cookie"));
  if (!cookie) {
    throw new Error("Admin login did not return an auth cookie.");
  }

  return { cookie, body };
}

async function retryRegistrations(baseUrl, cookie, sessionId) {
  const url = joinUrl(baseUrl, "/api/admin/retry-registration");
  const { response, body } = await postJson(
    url,
    sessionId ? { session_id: sessionId } : {},
    buildCommonHeaders(baseUrl, {
      cookie,
    }),
  );

  if (!response.ok) {
    throw new Error(
      `Retry request failed (${response.status}): ${JSON.stringify(body)}`,
    );
  }

  return body;
}

async function logout(baseUrl, cookie) {
  const url = joinUrl(baseUrl, "/api/admin/logout");
  const response = await fetch(url, {
    method: "POST",
    headers: buildCommonHeaders(baseUrl, {
      accept: "application/json",
      cookie,
    }),
  });

  return response.ok;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = trim(args["base-url"] || process.env.LUMAZCASH_BASE_URL);
  const adminPassword = trim(
    args["admin-password"] || process.env.LUMAZCASH_ADMIN_PASSWORD,
  );
  const sessionId = trim(
    args["session-id"] || process.env.LUMAZCASH_RETRY_SESSION_ID,
  );

  const targetBaseUrl = normalizeBaseUrl(baseUrl);
  const password = requireValue("Admin password", adminPassword);

  const loginResult = await login(targetBaseUrl, password);
  const retryResult = await retryRegistrations(
    targetBaseUrl,
    loginResult.cookie,
    sessionId,
  );

  await logout(targetBaseUrl, loginResult.cookie).catch(() => false);

  const summary = {
    base_url: targetBaseUrl.replace(/\/$/, ""),
    mode: sessionId ? "single-session" : "due-sessions",
    session_id: sessionId || null,
    login: loginResult.body,
    retry: retryResult,
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
