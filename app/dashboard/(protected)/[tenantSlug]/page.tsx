import { notFound } from "next/navigation";
import { TenantDashboard } from "@/components/TenantDashboard";
import { requireTenantPageAccess } from "@/lib/tenant-auth-server";
import { getTenantSelfServeDetailBySlug } from "@/lib/tenancy/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function TenantOverviewPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const email = await requireTenantPageAccess();
  const { tenantSlug } = await params;
  const detail = await getTenantSelfServeDetailBySlug(tenantSlug, email);
  if (!detail) {
    notFound();
  }

  return (
    <TenantDashboard
      audience="tenant"
      detail={detail}
      tenantBasePath={`/dashboard/${encodeURIComponent(detail.tenant.slug)}`}
    />
  );
}
