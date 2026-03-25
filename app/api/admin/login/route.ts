import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken,
  isAdminAuthEnabled,
  verifyAdminPassword,
} from "@/lib/admin-auth";
import { adminSessionCookieOptions } from "@/lib/admin-auth-server";
import { jsonError, jsonOk } from "@/lib/http";
import {
  consumeAdminLoginRateLimit,
  getRuntimeConfig,
  putAdminAuditEvent,
} from "@/lib/app-state/state";
import { hasCoreSetup } from "@/lib/app-state/utils";
import {
  ensureSameOriginMutation,
  getTrustedIpAddress,
} from "@/lib/request-security";
import { createRequestId, logEvent } from "@/lib/observability";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = createRequestId();
  const originError = ensureSameOriginMutation(request);
  const actorIp = getTrustedIpAddress(request);
  const actorOrigin = request.headers.get("origin");
  if (originError) {
    await putAdminAuditEvent({
      event_type: "admin.login.blocked_origin",
      actor_ip: actorIp,
      actor_origin: actorOrigin,
      request_headers_json: {
        origin: request.headers.get("origin"),
        referer: request.headers.get("referer"),
        "user-agent": request.headers.get("user-agent"),
      },
      metadata_json: {
        request_id: requestId,
      },
    });
    return originError;
  }

  if (!isAdminAuthEnabled()) {
    return jsonError("Admin auth is not enabled for this environment.", 503);
  }

  const rateLimit = await consumeAdminLoginRateLimit({ ipAddress: actorIp });
  if (!rateLimit.ok) {
    await putAdminAuditEvent({
      event_type: "admin.login.rate_limited",
      actor_ip: actorIp,
      actor_origin: actorOrigin,
      request_headers_json: {
        origin: request.headers.get("origin"),
        referer: request.headers.get("referer"),
        "user-agent": request.headers.get("user-agent"),
      },
      metadata_json: {
        request_id: requestId,
      },
    });
    return jsonError(rateLimit.reason || "Too many login attempts.", 429, {
      headers: {
        "retry-after": String(rateLimit.retry_after_seconds || 600),
      },
    });
  }

  const body = await request.json().catch(() => null);
  const password =
    body && typeof body === "object" && typeof body.password === "string"
      ? body.password
      : "";

  if (!verifyAdminPassword(password)) {
    await putAdminAuditEvent({
      event_type: "admin.login.failed",
      actor_ip: actorIp,
      actor_origin: actorOrigin,
      request_headers_json: {
        origin: request.headers.get("origin"),
        referer: request.headers.get("referer"),
        "user-agent": request.headers.get("user-agent"),
      },
      metadata_json: {
        request_id: requestId,
      },
    });
    logEvent("warn", "admin.login.failed", {
      request_id: requestId,
      actor_ip: actorIp,
    });
    return jsonError("Invalid password.", 401);
  }

  const config = await getRuntimeConfig({ allowMissingTable: true });
  const cookieStore = await cookies();
  cookieStore.set(
    ADMIN_SESSION_COOKIE,
    createAdminSessionToken(),
    adminSessionCookieOptions(),
  );

  await putAdminAuditEvent({
    event_type: "admin.login.succeeded",
    actor_ip: actorIp,
    actor_origin: actorOrigin,
    request_headers_json: {
      origin: request.headers.get("origin"),
      referer: request.headers.get("referer"),
      "user-agent": request.headers.get("user-agent"),
    },
    metadata_json: {
      request_id: requestId,
      next: hasCoreSetup(config) ? "/dashboard" : "/admin",
    },
  });
  logEvent("info", "admin.login.succeeded", {
    request_id: requestId,
    actor_ip: actorIp,
  });

  return jsonOk({
    ok: true,
    next: hasCoreSetup(config) ? "/dashboard" : "/admin",
  });
}
