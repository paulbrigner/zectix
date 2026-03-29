import {
  createTenantMagicLinkTokenHash,
  createTenantMagicLinkTokenValue,
  isTenantEmailAuthEnabled,
} from "@/lib/tenant-auth";
import { sendTenantMagicLinkEmail } from "@/lib/tenant-auth-email";
import {
  consumeTenantOnboardingRateLimit,
  deleteTenantMagicLinkToken,
  listTenantsByContactEmail,
  putAdminAuditEvent,
  putTenantMagicLinkToken,
} from "@/lib/app-state/state";
import { createTenant } from "@/lib/tenancy/service";
import { appPath } from "@/lib/app-paths";
import { redirectToPath } from "@/lib/http";
import { createRequestId, logEvent } from "@/lib/observability";
import {
  ensureSameOriginMutation,
  getTrustedIpAddress,
} from "@/lib/request-security";
import { normalizeEmailAddress, slugify } from "@/lib/app-state/utils";

export const runtime = "nodejs";

function startRedirectPath(error?: string, emailSent = false) {
  const url = new URL(appPath("/dashboard/start"), "https://service.invalid");
  if (error) {
    url.searchParams.set("error", error);
  }
  if (emailSent) {
    url.searchParams.set("email_sent", "1");
  }

  return `${url.pathname}${url.search}`;
}

export async function POST(request: Request) {
  const requestId = createRequestId();
  const originError = ensureSameOriginMutation(request);
  const actorIp = getTrustedIpAddress(request);
  const actorOrigin = request.headers.get("origin");

  if (originError) {
    await putAdminAuditEvent({
      event_type: "tenant.signup.blocked_origin",
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
    return redirectToPath(startRedirectPath("auth_disabled"));
  }

  const rateLimit = await consumeTenantOnboardingRateLimit({ ipAddress: actorIp });
  if (!rateLimit.ok) {
    return redirectToPath(startRedirectPath("rate_limited"));
  }

  const formData = await request.formData();
  const name = String(formData.get("name") || "").trim();
  const email = normalizeEmailAddress(String(formData.get("email") || ""));
  const requestedSlug = String(formData.get("slug") || "").trim();

  if (!name) {
    return redirectToPath(startRedirectPath("invalid_name"));
  }

  if (!email.includes("@")) {
    return redirectToPath(startRedirectPath("invalid_email"));
  }

  const existingTenants = await listTenantsByContactEmail(email);
  const duplicateTenant = existingTenants.find((tenant) => {
    const sameName = tenant.name.trim().toLowerCase() === name.toLowerCase();
    const sameSlug = requestedSlug ? tenant.slug === slugify(requestedSlug) : false;
    return tenant.status !== "archived" && (sameName || sameSlug);
  });

  const tenant =
    duplicateTenant ||
    (await createTenant({
      name,
      slug: requestedSlug || null,
      contact_email: email,
      onboarding_source: "self_serve",
      onboarding_status: "in_progress",
    }));

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
      event_type: "tenant.signup.link_failed",
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
        tenant_id: tenant.tenant_id,
        expires_at: expiresAt,
        reason: error instanceof Error ? error.message : "send_failed",
      },
    });
    logEvent("error", "tenant.signup.link_failed", {
      request_id: requestId,
      actor_ip: actorIp,
      email,
      tenant_id: tenant.tenant_id,
    });
    return redirectToPath(startRedirectPath("email_delivery_failed"));
  }

  await putAdminAuditEvent({
    event_type: duplicateTenant ? "tenant.signup.link_resent" : "tenant.signup.started",
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
      tenant_id: tenant.tenant_id,
      duplicate_tenant: Boolean(duplicateTenant),
      expires_at: expiresAt,
    },
  });
  logEvent("info", duplicateTenant ? "tenant.signup.link_resent" : "tenant.signup.started", {
    request_id: requestId,
    actor_ip: actorIp,
    email,
    tenant_id: tenant.tenant_id,
  });

  return redirectToPath(startRedirectPath(undefined, true));
}
