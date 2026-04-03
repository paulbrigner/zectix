import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { TenantDashboardHeaderMenu } from "@/components/TenantDashboardHeaderMenu";
import { getTenantBySlug } from "@/lib/app-state/state";
import { appPath } from "@/lib/app-paths";
import { normalizeEmailAddress } from "@/lib/app-state/utils";
import { hasCompletedTenantOnboarding } from "@/lib/tenant-self-serve";
import { requireTenantPageAccess } from "@/lib/tenant-auth-server";

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
  const tenant = await getTenantBySlug(tenantSlug);
  if (
    !tenant ||
    normalizeEmailAddress(tenant.contact_email) !== normalizeEmailAddress(email)
  ) {
    notFound();
  }

  const basePath = `/dashboard/${encodeURIComponent(tenant.slug)}`;
  const onboardingIncomplete = !hasCompletedTenantOnboarding(tenant);

  return (
    <>
      <header className="console-section tenant-dashboard-header">
        <div className="tenant-dashboard-header-top">
          <div>
            <p className="eyebrow">Organization</p>
            <h2>{tenant.name}</h2>
          </div>

          <TenantDashboardHeaderMenu
            basePath={basePath}
            logoutAction={appPath("/api/dashboard/logout")}
            onboardingIncomplete={onboardingIncomplete}
          />
        </div>
      </header>

      {children}
    </>
  );
}
