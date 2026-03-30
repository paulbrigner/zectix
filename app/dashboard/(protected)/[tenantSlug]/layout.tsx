import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { TenantWorkspaceNav } from "@/components/TenantWorkspaceNav";
import { getTenantBySlug } from "@/lib/app-state/state";
import { normalizeEmailAddress } from "@/lib/app-state/utils";
import { requireTenantPageAccess } from "@/lib/tenant-auth-server";

export const runtime = "nodejs";

function badgeTone(value: "active" | "draft" | "approved" | "started" | "pending_review" | string) {
  if (value === "active" || value === "approved") {
    return "success";
  }

  if (value === "draft" || value === "started") {
    return "warning";
  }

  return "muted";
}

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
            <p className="subtle-text">
              One place for checkout setup, event readiness, billing, and embeds.
            </p>
          </div>
          <div className="console-mini-pill-row tenant-workspace-meta">
            <span className={`console-mini-pill console-mini-pill-${badgeTone(tenant.status)}`}>
              organization {tenant.status}
            </span>
            <span
              className={`console-mini-pill console-mini-pill-${badgeTone(
                tenant.onboarding_status,
              )}`}
            >
              onboarding {tenant.onboarding_status.replaceAll("_", " ")}
            </span>
            <span className="console-mini-pill console-mini-pill-info">
              billing {tenant.billing_status}
            </span>
          </div>
        </div>

        <TenantWorkspaceNav basePath={basePath} />
      </header>

      {children}
    </>
  );
}
