import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken,
  isAdminAuthEnabled,
  verifyAdminPassword,
} from "@/lib/admin-auth";
import { adminSessionCookieOptions } from "@/lib/admin-auth-server";
import { consumeOpsLoginRateLimit, putAdminAuditEvent } from "@/lib/app-state/state";
import { createRequestId, logEvent } from "@/lib/observability";
import { ensureSameOriginMutation, getTrustedIpAddress } from "@/lib/request-security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const loginUrl = new URL("/ops/login", request.url);
  const requestId = createRequestId();
  const originError = ensureSameOriginMutation(request);
  const actorIp = getTrustedIpAddress(request);
  const actorOrigin = request.headers.get("origin");

  if (originError) {
    await putAdminAuditEvent({
      event_type: "ops.login.blocked_origin",
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
    loginUrl.searchParams.set("error", "auth_disabled");
    return Response.redirect(loginUrl, 303);
  }

  const rateLimit = await consumeOpsLoginRateLimit({ ipAddress: actorIp });
  if (!rateLimit.ok) {
    loginUrl.searchParams.set("error", "rate_limited");
    return Response.redirect(loginUrl, 303);
  }

  const formData = await request.formData();
  const password = String(formData.get("password") || "");

  if (!verifyAdminPassword(password)) {
    await putAdminAuditEvent({
      event_type: "ops.login.failed",
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
    logEvent("warn", "ops.login.failed", {
      request_id: requestId,
      actor_ip: actorIp,
    });
    loginUrl.searchParams.set("error", "invalid_password");
    return Response.redirect(loginUrl, 303);
  }

  const cookieStore = await cookies();
  cookieStore.set(
    ADMIN_SESSION_COOKIE,
    createAdminSessionToken(),
    adminSessionCookieOptions(),
  );

  await putAdminAuditEvent({
    event_type: "ops.login.succeeded",
    actor_ip: actorIp,
    actor_origin: actorOrigin,
    request_headers_json: {
      origin: request.headers.get("origin"),
      referer: request.headers.get("referer"),
      "user-agent": request.headers.get("user-agent"),
    },
    metadata_json: {
      request_id: requestId,
      next: "/ops",
    },
  });
  logEvent("info", "ops.login.succeeded", {
    request_id: requestId,
    actor_ip: actorIp,
  });

  return Response.redirect(new URL("/ops", request.url), 303);
}
