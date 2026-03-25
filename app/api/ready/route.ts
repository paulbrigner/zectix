import { getRuntimeConfig } from "@/lib/app-state/state";
import { asString, hasCoreSetup } from "@/lib/app-state/utils";
import { jsonOk } from "@/lib/http";
import { isAdminAuthEnabled } from "@/lib/admin-auth";
import { isSessionViewerProtectionEnabled } from "@/lib/runtime-env";

export const runtime = "nodejs";

export async function GET() {
  try {
    const config = await getRuntimeConfig();
    const ready = hasCoreSetup(config);

    const payload = {
      ok: ready,
      checks: {
        dynamodb: "ok",
        cipherpay_api_key: asString(config.api_key) ? "ok" : "missing",
        cipherpay_webhook_secret: asString(config.webhook_secret) ? "ok" : "missing",
        luma_api_key: asString(config.luma_api_key) ? "ok" : "missing",
        admin_auth: isAdminAuthEnabled() ? "ok" : "disabled",
        session_viewer: isSessionViewerProtectionEnabled() ? "ok" : "disabled",
      },
      ts: new Date().toISOString(),
    };

    if (!ready) {
      return Response.json(payload, { status: 503 });
    }

    return jsonOk(payload);
  } catch (error) {
    return Response.json(
      {
        ok: false,
        checks: {
          dynamodb: "error",
        },
        error: error instanceof Error ? error.message : "Readiness check failed",
        ts: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
