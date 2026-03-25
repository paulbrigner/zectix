import { ensureAdminApiAccess } from "@/lib/admin-auth-server";
import { putAdminAuditEvent } from "@/lib/app-state/state";
import {
  retryDueRegistrations,
  retryRegistrationForSession,
} from "@/lib/app-state/service";
import { jsonError, jsonOk } from "@/lib/http";
import { isValidOpsAutomationSecret } from "@/lib/ops-automation";
import {
  ensureSameOriginMutation,
  getTrustedIpAddress,
} from "@/lib/request-security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const automationAuthorized = isValidOpsAutomationSecret(
    request.headers.get("x-zectix-automation-secret"),
  );

  if (!automationAuthorized) {
    const authError = await ensureAdminApiAccess();
    if (authError) {
      return authError;
    }

    const originError = ensureSameOriginMutation(request);
    if (originError) {
      return originError;
    }
  }

  const body = await request.json().catch(() => null);
  const sessionId =
    body && typeof body === "object" && typeof body.session_id === "string"
      ? body.session_id.trim()
      : "";

  try {
    if (sessionId) {
      const session = await retryRegistrationForSession(sessionId);
      await putAdminAuditEvent({
        event_type: automationAuthorized
          ? "automation.retry_registration.session"
          : "admin.retry_registration.session",
        actor_ip: getTrustedIpAddress(request),
        actor_origin: request.headers.get("origin"),
        request_headers_json: {
          origin: request.headers.get("origin"),
          referer: request.headers.get("referer"),
          "user-agent": request.headers.get("user-agent"),
          "x-ops-source": request.headers.get("x-ops-source"),
        },
        metadata_json: {
          session_id: sessionId,
          registration_status: session.registration_status,
          automation: automationAuthorized,
        },
      });
      return jsonOk({ ok: true, session });
    }

    const sessions = await retryDueRegistrations(20);
    await putAdminAuditEvent({
      event_type: automationAuthorized
        ? "automation.retry_registration.due"
        : "admin.retry_registration.due",
      actor_ip: getTrustedIpAddress(request),
      actor_origin: request.headers.get("origin"),
      request_headers_json: {
        origin: request.headers.get("origin"),
        referer: request.headers.get("referer"),
        "user-agent": request.headers.get("user-agent"),
        "x-ops-source": request.headers.get("x-ops-source"),
      },
      metadata_json: {
        recovered_count: sessions.length,
        automation: automationAuthorized,
      },
    });
    return jsonOk({ ok: true, sessions });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to retry registration",
      500,
    );
  }
}
