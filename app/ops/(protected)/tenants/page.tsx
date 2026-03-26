import Link from "next/link";
import { createTenantAction } from "@/app/ops/actions";
import { listTenants } from "@/lib/app-state/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function TenantsPage() {
  const tenants = await listTenants();

  return (
    <>
      <section className="console-section">
        <div className="console-section-header">
          <div>
            <h2>New tenant</h2>
            <p className="subtle-text">Start with the organizer record, then connect Luma and CipherPay from the tenant detail page.</p>
          </div>
        </div>

        <form action={createTenantAction} className="console-content">
          <div className="public-field-grid">
            <label className="console-field">
              <span>Name</span>
              <input className="console-input" name="name" required type="text" />
            </label>
            <label className="console-field">
              <span>Slug</span>
              <input className="console-input" name="slug" type="text" />
            </label>
            <label className="console-field">
              <span>Contact email</span>
              <input className="console-input" name="contact_email" required type="email" />
            </label>
            <label className="console-field">
              <span>Monthly minimum (USD cents)</span>
              <input className="console-input" name="monthly_minimum_usd_cents" type="number" />
            </label>
            <label className="console-field">
              <span>Service fee (bps)</span>
              <input className="console-input" name="service_fee_bps" type="number" />
            </label>
            <label className="console-field">
              <span>Pilot notes</span>
              <input className="console-input" name="pilot_notes" type="text" />
            </label>
          </div>
          <button className="button" type="submit">
            Create tenant
          </button>
        </form>
      </section>

      <section className="console-section">
        <div className="console-section-header">
          <div>
            <h2>Existing tenants</h2>
            <p className="subtle-text">Open a tenant to attach secrets, sync events, and recover failed registrations.</p>
          </div>
        </div>

        <div className="console-card-grid">
          {tenants.map((tenant) => (
            <article className="console-detail-card" key={tenant.tenant_id}>
              <p className="console-kpi-label">{tenant.status}</p>
              <h3>{tenant.name}</h3>
              <p className="subtle-text">{tenant.contact_email}</p>
              <Link className="button button-secondary button-small" href={`/ops/tenants/${encodeURIComponent(tenant.tenant_id)}`}>
                Open tenant
              </Link>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
