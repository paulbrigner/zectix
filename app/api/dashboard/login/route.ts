import {
  createTenantMagicLinkTokenHash,
  createTenantMagicLinkTokenValue,
  isTenantEmailAuthEnabled,
} from "@/lib/tenant-auth";
import { sendTenantMagicLinkEmail } from "@/lib/tenant-auth-email";
import {
  consumeOpsLoginRateLimit,
  deleteTenantMagicLinkToken,
  putAdminAuditEvent,
  putTenantMagicLinkToken,
} from "@/lib/app-state/state";
import { listSelfServeTenantsForEmail } from "@/lib/tenancy/service";
import { appPath } from "@/lib/app-paths";
import { redirectToPath } from "@/lib/http";
import { createRequestId, logEvent } from "@/lib/observability";
import { ensureSameOriginMutation, getTrustedIpAddress } from "@/lib/request-security";

export const runtime = "nodejs";

function loginRedirectPath(error?: string, emailSent = false) {
  const loginUrl = new URL(appPath("/dashboard/login"), "https://service.invalid");
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
      event_type: "tenant.login.blocked_origin",
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

  if (!isTenantEmailAuthEnabled()) {
    return redirectToPath(loginRedirectPath("auth_disabled"));
  }

  const rateLimit = await consumeOpsLoginRateLimit({ ipAddress: actorIp });
  if (!rateLimit.ok) {
    return redirectToPath(loginRedirectPath("rate_limited"));
  }

  const formData = await request.formData();
  const email = String(formData.get("email") || "").trim().toLowerCase();

  if (!email.includes("@")) {
    return redirectToPath(loginRedirectPath("invalid_email"));
  }

  const accessibleTenants = await listSelfServeTenantsForEmail(email);
  if (accessibleTenants.length > 0) {
    const token = createTenantMagicLinkTokenValue();
    const tokenHash = createTenantMagicLinkTokenHash(token);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    try {
      await putTenantMagicLinkToken({
        tokenHash,
        email,
        expiresAt,
      });
      await sendTenantMagicLinkEmail(email, token);
    } catch (error) {
      try {
        await deleteTenantMagicLinkToken(tokenHash);
      } catch {
        // Ignore cleanup failures so the user still sees the delivery error.
      }

      await putAdminAuditEvent({
        event_type: "tenant.login.link_failed",
        actor_ip: actorIp,
        actor_origin: actorOrigin,
        request_headers_json: {
          origin: request.headers.get("origin"),
          referer: request.headers.get("referer"),
          "user-agent": request.headers.get("user-agent"),
        },
        metadata_json: {
          request_id: requestId,
          email,
          expires_at: expiresAt,
          reason: error instanceof Error ? error.message : "send_failed",
        },
      });
      logEvent("error", "tenant.login.link_failed", {
        request_id: requestId,
        actor_ip: actorIp,
        email,
      });
      return redirectToPath(loginRedirectPath("email_delivery_failed"));
    }

    await putAdminAuditEvent({
      event_type: "tenant.login.link_sent",
      actor_ip: actorIp,
      actor_origin: actorOrigin,
      request_headers_json: {
        origin: request.headers.get("origin"),
        referer: request.headers.get("referer"),
        "user-agent": request.headers.get("user-agent"),
      },
      metadata_json: {
        request_id: requestId,
        email,
        tenant_count: accessibleTenants.length,
        expires_at: expiresAt,
      },
    });
    logEvent("info", "tenant.login.link_sent", {
      request_id: requestId,
      actor_ip: actorIp,
      email,
      tenant_count: accessibleTenants.length,
    });
  } else {
    await putAdminAuditEvent({
      event_type: "tenant.login.link_ignored",
      actor_ip: actorIp,
      actor_origin: actorOrigin,
      request_headers_json: {
        origin: request.headers.get("origin"),
        referer: request.headers.get("referer"),
        "user-agent": request.headers.get("user-agent"),
      },
      metadata_json: {
        request_id: requestId,
        email,
      },
    });
    logEvent("warn", "tenant.login.link_ignored", {
      request_id: requestId,
      actor_ip: actorIp,
      email,
    });
  }

  return redirectToPath(loginRedirectPath(undefined, true));
}
