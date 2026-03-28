import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
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
      <header className="console-section">
        <div className="console-section-header">
          <div>
            <p className="eyebrow">Tenant</p>
            <h2>{tenant.name}</h2>
            <p className="subtle-text">
              Manage calendar setup, mirrored events, and checkout readiness for this tenant.
            </p>
          </div>
        </div>

        <nav className="console-nav">
          <Link className="console-nav-link" href={basePath}>
            Overview
          </Link>
          <Link className="console-nav-link" href={`${basePath}/events`}>
            Events
          </Link>
          <Link className="console-nav-link" href={`${basePath}/settings`}>
            Settings
          </Link>
        </nav>
      </header>

      {children}
    </>
  );
}
