import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { TenantWorkspaceNav } from "@/components/TenantWorkspaceNav";
import { getTenantBySlug } from "@/lib/app-state/state";
import { normalizeEmailAddress } from "@/lib/app-state/utils";
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
  if (!tenant || normalizeEmailAddress(tenant.contact_email) !== normalizeEmailAddress(email)) {
    notFound();
  }

  const basePath = `/dashboard/${encodeURIComponent(tenant.slug)}`;

  return (
    <>
      <header className="console-section tenant-workspace-header">
        <div className="tenant-workspace-header-top">
          <div>
            <p className="eyebrow">Organization</p>
            <h2>{tenant.name}</h2>
          </div>
        </div>

        <TenantWorkspaceNav basePath={basePath} />
      </header>

      {children}
    </>
  );
}
