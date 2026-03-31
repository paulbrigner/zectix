import { notFound } from "next/navigation";
import { TenantConnectionsWorkspace } from "@/components/TenantConnectionsWorkspace";
import { requireTenantPageAccess } from "@/lib/tenant-auth-server";
import { getTenantSelfServeDetailBySlug } from "@/lib/tenancy/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function TenantConnectionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const email = await requireTenantPageAccess();
  const { tenantSlug } = await params;
  const resolvedSearchParams = await searchParams;
  const detail = await getTenantSelfServeDetailBySlug(tenantSlug, email);
  if (!detail) {
    notFound();
  }

  return (
    <TenantConnectionsWorkspace
      detail={detail}
      searchParams={resolvedSearchParams}
      tenantBasePath={`/dashboard/${encodeURIComponent(detail.tenant.slug)}`}
    />
  );
}
