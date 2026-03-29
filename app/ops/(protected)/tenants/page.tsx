import Link from "next/link";
import { createTenantAction } from "@/app/ops/actions";
import { ConsoleDisclosure } from "@/components/ConsoleDisclosure";
import { ConsoleFieldLabel } from "@/components/ConsoleFieldLabel";
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

        <ConsoleDisclosure
          defaultOpen={!tenants.length}
          description="Commercial terms are ZEC-native and can be refined later from the tenant detail page."
          title="Create organizer record"
        >
          <form action={createTenantAction} className="console-content">
            <div className="public-field-grid">
              <label className="console-field">
                <ConsoleFieldLabel label="Name" />
                <input className="console-input" name="name" required type="text" />
              </label>
              <label className="console-field">
                <ConsoleFieldLabel
                  info="Used for internal tenant identity and future organizer URLs. Leave blank to generate it from the name and add a numeric suffix if needed."
                  label="Slug"
                  optional
                />
                <input className="console-input" name="slug" type="text" />
              </label>
              <label className="console-field">
                <ConsoleFieldLabel
                  info="Primary service-manager contact for this tenant."
                  label="Contact email"
                />
                <input className="console-input" name="contact_email" required type="email" />
              </label>
              <label className="console-field">
                <ConsoleFieldLabel
                  info="Service fee in basis points. 100 bps = 1%."
                  label="Service fee (bps)"
                  optional
                />
                <input className="console-input" name="service_fee_bps" type="number" />
              </label>
              <label className="console-field">
                <ConsoleFieldLabel
                  info="How many days after the monthly cycle closes before unpaid balances are considered overdue."
                  label="Billing grace days"
                  optional
                />
                <input className="console-input" defaultValue={7} name="billing_grace_days" type="number" />
              </label>
              <label className="console-field">
                <ConsoleFieldLabel
                  info="Below this zatoshi balance, billing can be carried manually until more volume accrues."
                  label="Settlement threshold (zatoshis)"
                  optional
                />
                <input className="console-input" name="settlement_threshold_zatoshis" type="number" />
              </label>
              <label className="console-field">
                <ConsoleFieldLabel
                  info="Separate from tenant status so public checkout availability and billing delinquency can be managed independently."
                  label="Billing status"
                  optional
                />
                <select className="console-input" defaultValue="active" name="billing_status">
                  <option value="active">active</option>
                  <option value="past_due">past_due</option>
                  <option value="suspended">suspended</option>
                </select>
              </label>
              <label className="console-field">
                <ConsoleFieldLabel
                  info="Internal-only notes about pilot scope, exceptions, or support context."
                  label="Pilot notes"
                  optional
                />
                <input className="console-input" name="pilot_notes" type="text" />
              </label>
            </div>
            <button className="button" type="submit">
              Create tenant
            </button>
          </form>
        </ConsoleDisclosure>
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
              <div className="button-row">
                <Link className="button button-secondary button-small" href={`/ops/tenants/${encodeURIComponent(tenant.tenant_id)}/dashboard`}>
                  Dashboard
                </Link>
                <Link className="button button-secondary button-small" href={`/ops/tenants/${encodeURIComponent(tenant.tenant_id)}`}>
                  Open tenant
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
