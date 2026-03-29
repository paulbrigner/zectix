import { listTenants } from "@/lib/app-state/state";
import { jsonOk } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  const tenants = await listTenants();
  return jsonOk({
    ok: true,
    tenants: tenants.length,
    tenant_traffic_ready: tenants.length > 0,
    ts: new Date().toISOString(),
  });
}
