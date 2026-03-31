import { cookies } from "next/headers";
import {
  createTenantMagicLinkTokenHash,
  createTenantSessionToken,
  isTenantEmailAuthEnabled,
  TENANT_SESSION_COOKIE,
} from "@/lib/tenant-auth";
import { tenantSessionCookieOptions } from "@/lib/tenant-auth-server";
import {
  consumeTenantMagicLinkToken,
  getTenant,
  putAdminAuditEvent,
} from "@/lib/app-state/state";
import {
  listSelfServeTenantsForEmail,
  updateTenantContactEmail,
} from "@/lib/tenancy/service";
import { appPath } from "@/lib/app-paths";
import { redirectToPath } from "@/lib/http";
import { createRequestId, logEvent } from "@/lib/observability";
import { authAuditEmailMetadata } from "@/lib/privacy";
import { getTrustedIpAddress } from "@/lib/request-security";

export const runtime = "nodejs";

function loginRedirectPath(error?: string) {
  const loginUrl = new URL(appPath("/dashboard/login"), "https://service.invalid");
  if (error) {
    loginUrl.searchParams.set("error", error);
  }

  return `${loginUrl.pathname}${loginUrl.search}`;
}

export async function GET(request: Request) {
  const requestId = createRequestId();
  const actorIp = getTrustedIpAddress(request);
  const actorOrigin = request.headers.get("origin");

  if (!isTenantEmailAuthEnabled()) {
    return redirectToPath(loginRedirectPath("auth_disabled"));
  }

  const token = new URL(request.url).searchParams.get("token");
  let email: string | null = null;
  let confirmedTenantSettingsPath: string | null = null;

  try {
    const tokenHash = createTenantMagicLinkTokenHash(String(token || ""));
    const record = await consumeTenantMagicLinkToken(tokenHash);
    const notExpired = record?.expires_at && Date.parse(record.expires_at) > Date.now();
    if (
      record?.purpose === "confirm_contact_email" &&
      record?.tenant_id &&
      record.next_contact_email &&
      notExpired
    ) {
      const tenant = await getTenant(record.tenant_id);
      if (tenant) {
        const updatedTenant = await updateTenantContactEmail(
          tenant.tenant_id,
          record.next_contact_email,
        );
        email = updatedTenant.contact_email;
        await putAdminAuditEvent({
          event_type: "tenant.dashboard.confirm_contact_email",
          actor_ip: actorIp,
          actor_origin: actorOrigin,
          request_headers_json: null,
          metadata_json: {
            request_id: requestId,
            next_contact_email: updatedTenant.contact_email,
            previous_contact_email: record.previous_contact_email,
            tenant_id: updatedTenant.tenant_id,
            tenant_slug: updatedTenant.slug,
          },
        });
        confirmedTenantSettingsPath = appPath(
          `/dashboard/${encodeURIComponent(updatedTenant.slug)}/settings?email_updated=1`,
        );
      }
    } else if (record?.email && notExpired) {
      const tenants = await listSelfServeTenantsForEmail(record.email);
      if (tenants.length > 0) {
        email = record.email;
      }
    }
  } catch {
    email = null;
  }

  if (!email) {
    await putAdminAuditEvent({
      event_type: "tenant.login.verify_failed",
      actor_ip: actorIp,
      actor_origin: actorOrigin,
      request_headers_json: null,
      metadata_json: {
        request_id: requestId,
      },
    });
    logEvent("warn", "tenant.login.verify_failed", {
      request_id: requestId,
    });
    return redirectToPath(loginRedirectPath("invalid_link"));
  }

  const cookieStore = await cookies();
  cookieStore.set(
    TENANT_SESSION_COOKIE,
    createTenantSessionToken(email),
    tenantSessionCookieOptions(),
  );

  await putAdminAuditEvent({
    event_type: "tenant.login.succeeded",
    actor_ip: actorIp,
    actor_origin: actorOrigin,
    request_headers_json: null,
    metadata_json: {
      request_id: requestId,
      method: "magic_link",
      ...authAuditEmailMetadata(email),
      next: "/dashboard",
    },
  });
  logEvent("info", "tenant.login.succeeded", {
    request_id: requestId,
    method: "magic_link",
  });

  return redirectToPath(confirmedTenantSettingsPath || appPath("/dashboard"));
}
