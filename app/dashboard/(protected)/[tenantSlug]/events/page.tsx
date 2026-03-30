import { notFound } from "next/navigation";
import { TenantEventsWorkspace } from "@/components/TenantEventsWorkspace";
import { requireTenantPageAccess } from "@/lib/tenant-auth-server";
import { getTenantSelfServeDetailBySlug } from "@/lib/tenancy/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SearchParamValue = string | string[] | undefined;

export default async function TenantEventsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<Record<string, SearchParamValue>>;
}) {
  const email = await requireTenantPageAccess();
  const { tenantSlug } = await params;
  const resolvedSearchParams = await searchParams;
  const detail = await getTenantSelfServeDetailBySlug(tenantSlug, email);
  if (!detail) {
    notFound();
  }

  return (
    <TenantEventsWorkspace
      detail={detail}
      searchParams={resolvedSearchParams}
      tenantBasePath={`/dashboard/${encodeURIComponent(detail.tenant.slug)}`}
    />
  );
}
