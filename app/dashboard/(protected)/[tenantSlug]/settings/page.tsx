import { notFound } from "next/navigation";
import { TenantSettingsWorkspace } from "@/components/TenantSettingsWorkspace";
import { requireTenantPageAccess } from "@/lib/tenant-auth-server";
import { getTenantSelfServeDetailBySlug } from "@/lib/tenancy/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function TenantSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const email = await requireTenantPageAccess();
  const { tenantSlug } = await params;
  const resolvedSearchParams = await searchParams;
  const detail = await getTenantSelfServeDetailBySlug(tenantSlug, email);
  if (!detail) {
    notFound();
  }

  return (
    <TenantSettingsWorkspace
      detail={detail}
      searchParams={resolvedSearchParams}
      tenantBasePath={`/dashboard/${encodeURIComponent(detail.tenant.slug)}`}
    />
  );
}
