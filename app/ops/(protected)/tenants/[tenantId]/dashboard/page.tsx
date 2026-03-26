import { notFound } from "next/navigation";
import { TenantDashboard } from "@/components/TenantDashboard";
import { getTenantOpsDetail } from "@/lib/tenancy/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function TenantDashboardPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const detail = await getTenantOpsDetail(tenantId);
  if (!detail) {
    notFound();
  }

  return (
    <TenantDashboard
      detail={detail}
      tenantBasePath={`/ops/tenants/${encodeURIComponent(detail.tenant.tenant_id)}`}
    />
  );
}
