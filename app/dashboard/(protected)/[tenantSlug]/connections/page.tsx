import { notFound } from "next/navigation";
import { TenantConnectionsWorkspace } from "@/components/TenantConnectionsWorkspace";
import { requireTenantPageAccess } from "@/lib/tenant-auth-server";
import { getTenantSelfServeDetailBySlug } from "@/lib/tenancy/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function TenantConnectionsPage({
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
    <TenantConnectionsWorkspace
      detail={detail}
      tenantBasePath={`/dashboard/${encodeURIComponent(detail.tenant.slug)}`}
    />
  );
}
