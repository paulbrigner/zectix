import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TenantWorkspaceNav } from "@/components/TenantWorkspaceNav";
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

          <div className="tenant-dashboard-header-actions">
            <TenantWorkspaceNav
              basePath={basePath}
              onboardingIncomplete={onboardingIncomplete}
            />
            <div className="tenant-dashboard-utilities">
              <Link
                className="tenant-dashboard-utility-link"
                href="/dashboard/help"
              >
                Help
              </Link>
              <form action={appPath("/api/dashboard/logout")} method="post">
                <button
                  className="tenant-dashboard-utility-link tenant-dashboard-utility-link-strong"
                  type="submit"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      {children}
    </>
  );
}
