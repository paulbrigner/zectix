import { notFound, redirect } from "next/navigation";
import { TenantOverviewWorkspace } from "@/components/TenantOverviewWorkspace";
import { requireTenantPageAccess } from "@/lib/tenant-auth-server";
import { getTenantSelfServeDetailBySlug } from "@/lib/tenancy/service";
import { hasCompletedTenantOnboarding } from "@/lib/tenant-self-serve";

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

  if (!hasCompletedTenantOnboarding(detail.tenant)) {
    redirect(`/dashboard/${encodeURIComponent(detail.tenant.slug)}/connections`);
  }

  return (
    <TenantOverviewWorkspace detail={detail} />
  );
}
