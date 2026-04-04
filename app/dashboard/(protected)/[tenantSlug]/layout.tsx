import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { TenantDashboardShellHeader } from "@/components/TenantDashboardShellHeader";
import { normalizeEmailAddress } from "@/lib/app-state/utils";
import { hasCompletedTenantOnboarding } from "@/lib/tenant-self-serve";
import { requireTenantPageAccess } from "@/lib/tenant-auth-server";
import { getTenantSelfServeDetailBySlug } from "@/lib/tenancy/service";

export const runtime = "nodejs";

export default async function TenantScopedLayout({
  children,
  params,
}: Readonly<{
  children: ReactNode;
  params: Promise<{ tenantSlug: string }>;
}>) {
  const email = await requireTenantPageAccess();
  const { tenantSlug } = await params;
  const detail = await getTenantSelfServeDetailBySlug(tenantSlug, email);
  if (!detail) {
    notFound();
  }

  const tenant = detail.tenant;
  const basePath = `/dashboard/${encodeURIComponent(tenant.slug)}`;
  const onboardingIncomplete = !hasCompletedTenantOnboarding(tenant);

  return (
    <>
      <TenantDashboardShellHeader
        basePath={basePath}
        onboardingIncomplete={onboardingIncomplete}
        organizationName={tenant.name}
      />

      {children}
    </>
  );
}
