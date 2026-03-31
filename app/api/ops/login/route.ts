import { cookies } from "next/headers";
import {
  ADMIN_MAGIC_LINK_TTL_SECONDS,
  ADMIN_SESSION_COOKIE,
  createAdminMagicLinkTokenHash,
  createAdminMagicLinkTokenValue,
  createAdminSessionToken,
  getAdminAuthMode,
  isAdminAuthEnabled,
  isAllowedAdminLoginEmail,
  verifyAdminPassword,
} from "@/lib/admin-auth";
import { sendAdminMagicLinkEmail } from "@/lib/admin-auth-email";
import { adminSessionCookieOptions } from "@/lib/admin-auth-server";
import {
  consumeOpsLoginRateLimit,
  deleteAdminMagicLinkToken,
  putAdminAuditEvent,
  putAdminMagicLinkToken,
} from "@/lib/app-state/state";
import { appPath } from "@/lib/app-paths";
import { redirectToPath } from "@/lib/http";
import { createRequestId, logEvent } from "@/lib/observability";
import {
  authAuditEmailMetadata,
  summarizeAuthRequestHeaders,
} from "@/lib/privacy";
import { isValidEmailAddress, normalizeEmailAddress } from "@/lib/app-state/utils";
import { ensureSameOriginMutation, getTrustedIpAddress } from "@/lib/request-security";

export const runtime = "nodejs";

function loginRedirectPath(error?: string, emailSent = false) {
  const loginUrl = new URL(appPath("/ops/login"), "https://service.invalid");
  if (error) {
    loginUrl.searchParams.set("error", error);
  }
  if (emailSent) {
    loginUrl.searchParams.set("email_sent", "1");
  }

  return `${loginUrl.pathname}${loginUrl.search}`;
}

export async function POST(request: Request) {
  const requestId = createRequestId();
  const originError = ensureSameOriginMutation(request);
  const actorIp = getTrustedIpAddress(request);
  const actorOrigin = request.headers.get("origin");

  if (originError) {
    await putAdminAuditEvent({
      event_type: "ops.login.blocked_origin",
      actor_ip: actorIp,
      actor_origin: actorOrigin,
      request_headers_json: summarizeAuthRequestHeaders(request, { includeOrigin: true }),
      metadata_json: {
        request_id: requestId,
      },
    });
    return originError;
  }

  if (!isAdminAuthEnabled()) {
    return redirectToPath(loginRedirectPath("auth_disabled"));
  }

  const authMode = getAdminAuthMode();

  const rateLimit = await consumeOpsLoginRateLimit({ ipAddress: actorIp });
  if (!rateLimit.ok) {
    return redirectToPath(loginRedirectPath("rate_limited"));
  }

  const formData = await request.formData();
  if (authMode === "email") {
    const email = normalizeEmailAddress(String(formData.get("email") || ""));

    if (!isValidEmailAddress(email)) {
      return redirectToPath(loginRedirectPath("invalid_email"));
    }

    if (isAllowedAdminLoginEmail(email)) {
      const token = createAdminMagicLinkTokenValue();
      const tokenHash = createAdminMagicLinkTokenHash(token);
      const expiresAt = new Date(
        Date.now() + ADMIN_MAGIC_LINK_TTL_SECONDS * 1000,
      ).toISOString();

      try {
        await putAdminMagicLinkToken({
          tokenHash,
          email,
          expiresAt,
        });
        await sendAdminMagicLinkEmail(email, token);
      } catch (error) {
        try {
          await deleteAdminMagicLinkToken(tokenHash);
        } catch {
          // Ignore cleanup failures so the operator still sees the delivery error.
        }

        await putAdminAuditEvent({
          event_type: "ops.login.link_failed",
          actor_ip: actorIp,
          actor_origin: actorOrigin,
          request_headers_json: null,
          metadata_json: {
            request_id: requestId,
            ...authAuditEmailMetadata(email),
            expires_at: expiresAt,
            reason: error instanceof Error ? error.message : "send_failed",
          },
        });
        logEvent("error", "ops.login.link_failed", {
          request_id: requestId,
        });
        return redirectToPath(loginRedirectPath("email_delivery_failed"));
      }

      await putAdminAuditEvent({
        event_type: "ops.login.link_sent",
        actor_ip: actorIp,
        actor_origin: actorOrigin,
        request_headers_json: null,
        metadata_json: {
          request_id: requestId,
          ...authAuditEmailMetadata(email),
          expires_at: expiresAt,
        },
      });
      logEvent("info", "ops.login.link_sent", {
        request_id: requestId,
      });
    } else {
      await putAdminAuditEvent({
        event_type: "ops.login.link_ignored",
        actor_ip: actorIp,
        actor_origin: actorOrigin,
        request_headers_json: null,
        metadata_json: {
          request_id: requestId,
          ...authAuditEmailMetadata(email),
        },
      });
      logEvent("warn", "ops.login.link_ignored", {
        request_id: requestId,
      });
    }

    return redirectToPath(loginRedirectPath(undefined, true));
  }

  const password = String(formData.get("password") || "");

  if (!verifyAdminPassword(password)) {
    await putAdminAuditEvent({
      event_type: "ops.login.failed",
      actor_ip: actorIp,
      actor_origin: actorOrigin,
      request_headers_json: null,
      metadata_json: {
        request_id: requestId,
      },
    });
    logEvent("warn", "ops.login.failed", {
      request_id: requestId,
    });
    return redirectToPath(loginRedirectPath("invalid_password"));
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
    request_headers_json: null,
    metadata_json: {
      request_id: requestId,
      next: "/ops",
    },
  });
  logEvent("info", "ops.login.succeeded", {
    request_id: requestId,
  });

  return redirectToPath(appPath("/ops"));
}
