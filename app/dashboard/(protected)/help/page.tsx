import Link from "next/link";
import { submitSupportRequestAction } from "@/app/dashboard/actions";
import { requireTenantPageAccess } from "@/lib/tenant-auth-server";
import { listSelfServeTenantsForEmail } from "@/lib/tenancy/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function TenantHelpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string; tenant?: string; from?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const email = await requireTenantPageAccess();
  const tenants = await listSelfServeTenantsForEmail(email);
  const selectedTenantSlug =
    resolvedSearchParams.tenant &&
    tenants.some((tenant) => tenant.slug === resolvedSearchParams.tenant)
      ? resolvedSearchParams.tenant
      : tenants.length === 1
        ? tenants[0].slug
        : "";
  const selectedTenant =
    tenants.find((tenant) => tenant.slug === selectedTenantSlug) || null;

  return (
    <section className="console-section">
      <div className="console-section-header">
        <div>
          <h2>Help</h2>
          <p className="subtle-text">
            Send a support request without leaving your organizer dashboard.
          </p>
        </div>
        <Link
          className="button button-secondary button-small"
          href={
            selectedTenant
              ? `/dashboard/${encodeURIComponent(selectedTenant.slug)}`
              : "/dashboard"
          }
        >
          Back to dashboard
        </Link>
      </div>

      {resolvedSearchParams.sent === "1" ? (
        <p className="console-success-text">
          Your support request was sent. We&apos;ll follow up by email.
        </p>
      ) : null}
      {resolvedSearchParams.error ? (
        <p className="console-error-text">{resolvedSearchParams.error}</p>
      ) : null}

      <form action={submitSupportRequestAction} className="console-content">
        <input name="redirect_to" type="hidden" value="/dashboard/help" />
        <input
          name="context_path"
          type="hidden"
          value={resolvedSearchParams.from || ""}
        />

        {tenants.length > 1 ? (
          <label className="console-field">
            <span className="console-field-label">
              <span className="console-field-label-row">
                <span>Organization</span>
              </span>
              <span className="console-field-help">
                <span aria-hidden="true" className="console-info-indicator">
                  i
                </span>
                <span>
                  Choose the organization this request is about so we can review
                  the right calendar and billing context.
                </span>
              </span>
            </span>
            <select
              className="console-input"
              defaultValue={selectedTenantSlug}
              name="tenant_slug"
            >
              <option value="">General question</option>
              {tenants.map((tenant) => (
                <option key={tenant.tenant_id} value={tenant.slug}>
                  {tenant.name}
                </option>
              ))}
            </select>
          </label>
        ) : selectedTenant ? (
          <>
            <input name="tenant_slug" type="hidden" value={selectedTenant.slug} />
            <div className="console-detail-card">
              <p className="console-kpi-label">Organization</p>
              <h3>{selectedTenant.name}</h3>
              <p className="subtle-text">
                This request will include your current organizer context.
              </p>
            </div>
          </>
        ) : null}

        <label className="console-field">
          <span className="console-field-label">
            <span className="console-field-label-row">
              <span>Subject</span>
            </span>
            <span className="console-field-help">
              <span aria-hidden="true" className="console-info-indicator">
                i
              </span>
              <span>
                Keep this short and specific, for example &quot;Luma sync
                failed&quot; or &quot;Embed origin question&quot;.
              </span>
            </span>
          </span>
          <input className="console-input" name="subject" required type="text" />
        </label>

        <label className="console-field">
          <span className="console-field-label">
            <span className="console-field-label-row">
              <span>Message</span>
            </span>
            <span className="console-field-help">
              <span aria-hidden="true" className="console-info-indicator">
                i
              </span>
              <span>
                Include what you expected, what you saw instead, and any event,
                ticket, or checkout details that will help us trace it quickly.
              </span>
            </span>
          </span>
          <textarea
            className="console-input console-textarea"
            name="message"
            required
          />
        </label>

        <div className="button-row">
          <button className="button" type="submit">
            Send support request
          </button>
          <Link
            className="button button-secondary"
            href={
              selectedTenant
                ? `/dashboard/${encodeURIComponent(selectedTenant.slug)}`
                : "/dashboard"
            }
          >
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}
