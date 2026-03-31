import Link from "next/link";
import { redirect } from "next/navigation";
import { requireTenantPageAccess } from "@/lib/tenant-auth-server";
import { getTenantSelfServeDetailBySlug, listSelfServeTenantsForEmail } from "@/lib/tenancy/service";
import { hasCompletedTenantOnboarding } from "@/lib/tenant-self-serve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function TenantHomePage() {
  const email = await requireTenantPageAccess();
  const tenants = await listSelfServeTenantsForEmail(email);

  if (tenants.length === 1) {
    const detail = await getTenantSelfServeDetailBySlug(tenants[0].slug, email);
    if (detail) {
      const destination = hasCompletedTenantOnboarding(detail.tenant)
        ? `/dashboard/${encodeURIComponent(tenants[0].slug)}`
        : `/dashboard/${encodeURIComponent(tenants[0].slug)}/connections`;
      redirect(destination);
    }

    redirect(`/dashboard/${encodeURIComponent(tenants[0].slug)}`);
  }

  return (
    <section className="console-section">
      <div className="console-section-header">
        <div>
          <h2>Your organizations</h2>
          <p className="subtle-text">
            Choose which dashboard you want to open.
          </p>
        </div>
      </div>

      {!tenants.length ? (
        <div className="console-detail-card">
          <h3>No dashboard access is configured for this email yet</h3>
          <p className="subtle-text">
            Sign in with the contact email configured on your organization or ask the service
            manager to update that contact email.
          </p>
        </div>
      ) : (
        <div className="console-card-grid">
          {tenants.map((tenant) => (
            <article className="console-detail-card" key={tenant.tenant_id}>
              <p className="console-kpi-label">{tenant.status}</p>
              <h3>{tenant.name}</h3>
              <p className="subtle-text">{tenant.contact_email}</p>
              <Link
                className="button button-secondary button-small"
                href={`/dashboard/${encodeURIComponent(tenant.slug)}`}
              >
                Open dashboard
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
