import { ensureAdminApiAccess } from "@/lib/admin-auth-server";
import { getRuntimeConfig, updateRuntimeConfig } from "@/lib/test-harness/state";
import { toPublicConfig } from "@/lib/test-harness/utils";
import { jsonError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  const authError = await ensureAdminApiAccess();
  if (authError) {
    return authError;
  }

  try {
    const config = await getRuntimeConfig({ allowMissingTable: true });
    return jsonOk({
      config: toPublicConfig(config),
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to load admin config",
      500,
    );
  }
}

export async function PUT(request: Request) {
  const authError = await ensureAdminApiAccess();
  if (authError) {
    return authError;
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("Invalid JSON body");
  }

  try {
    const config = await updateRuntimeConfig({
      network: body.network === "mainnet" ? "mainnet" : body.network === "testnet" ? "testnet" : undefined,
      api_base_url:
        typeof body.api_base_url === "string" ? body.api_base_url.trim() : undefined,
      checkout_base_url:
        typeof body.checkout_base_url === "string"
          ? body.checkout_base_url.trim()
          : undefined,
      api_key: typeof body.api_key === "string" && body.api_key.trim() ? body.api_key.trim() : undefined,
      webhook_secret:
        typeof body.webhook_secret === "string" && body.webhook_secret.trim()
          ? body.webhook_secret.trim()
          : undefined,
      luma_api_key:
        typeof body.luma_api_key === "string" && body.luma_api_key.trim()
          ? body.luma_api_key.trim()
          : undefined,
    });

    return jsonOk({
      config: toPublicConfig(config),
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to save admin config",
      500,
    );
  }
}
