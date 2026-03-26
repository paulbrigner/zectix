import { listTenants } from "@/lib/app-state/state";
import { jsonError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  const tenants = await listTenants();
  if (tenants.length === 0) {
    return jsonError("No tenants configured yet.", 503);
  }

  return jsonOk({
    ok: true,
    tenants: tenants.length,
    ts: new Date().toISOString(),
  });
}
