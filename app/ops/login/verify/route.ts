import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  createAdminMagicLinkTokenHash,
  createAdminSessionToken,
  isAdminEmailAuthEnabled,
  isAllowedAdminLoginEmail,
} from "@/lib/admin-auth";
import { adminSessionCookieOptions } from "@/lib/admin-auth-server";
import { consumeAdminMagicLinkToken, putAdminAuditEvent } from "@/lib/app-state/state";
import { appPath } from "@/lib/app-paths";
import { redirectToPath } from "@/lib/http";
import { createRequestId, logEvent } from "@/lib/observability";
import { getTrustedIpAddress } from "@/lib/request-security";

export const runtime = "nodejs";

function loginRedirectPath(error?: string) {
  const loginUrl = new URL(appPath("/ops/login"), "https://service.invalid");
  if (error) {
    loginUrl.searchParams.set("error", error);
  }

  return `${loginUrl.pathname}${loginUrl.search}`;
}

export async function GET(request: Request) {
  const requestId = createRequestId();
  const actorIp = getTrustedIpAddress(request);
  const actorOrigin = request.headers.get("origin");

  if (!isAdminEmailAuthEnabled()) {
    return redirectToPath(loginRedirectPath("auth_disabled"));
  }

  const token = new URL(request.url).searchParams.get("token");
  let email: string | null = null;

  try {
    const tokenHash = createAdminMagicLinkTokenHash(String(token || ""));
    const record = await consumeAdminMagicLinkToken(tokenHash);
    const notExpired =
      record?.expires_at && Date.parse(record.expires_at) > Date.now();
    if (record?.email && notExpired && isAllowedAdminLoginEmail(record.email)) {
      email = record.email;
    }
  } catch {
    email = null;
  }

  if (!email) {
    await putAdminAuditEvent({
      event_type: "ops.login.verify_failed",
      actor_ip: actorIp,
      actor_origin: actorOrigin,
      request_headers_json: {
        referer: request.headers.get("referer"),
        "user-agent": request.headers.get("user-agent"),
      },
      metadata_json: {
        request_id: requestId,
      },
    });
    logEvent("warn", "ops.login.verify_failed", {
      request_id: requestId,
      actor_ip: actorIp,
    });
    return redirectToPath(loginRedirectPath("invalid_link"));
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
      referer: request.headers.get("referer"),
      "user-agent": request.headers.get("user-agent"),
    },
    metadata_json: {
      request_id: requestId,
      method: "magic_link",
      email,
      next: "/ops",
    },
  });
  logEvent("info", "ops.login.succeeded", {
    request_id: requestId,
    actor_ip: actorIp,
    method: "magic_link",
    email,
  });

  return redirectToPath(appPath("/ops"));
}
