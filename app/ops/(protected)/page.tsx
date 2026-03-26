import Link from "next/link";
import { getOpsDashboardData } from "@/lib/app-state/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function OpsOverviewPage() {
  const data = await getOpsDashboardData();

  return (
    <>
      <section className="console-section">
        <div className="console-section-header">
          <div>
            <h2>Service overview</h2>
            <p className="subtle-text">
              Recent tenant activity across mirrored events, webhook intake, and registration processing.
            </p>
          </div>
        </div>

        <div className="console-kpi-grid">
          <article className="console-kpi-card">
            <p className="console-kpi-label">Tenants</p>
            <p className="console-kpi-value">{data.tenants.length}</p>
          </article>
          <article className="console-kpi-card">
            <p className="console-kpi-label">Recent sessions</p>
            <p className="console-kpi-value">{data.recent_sessions.length}</p>
          </article>
          <article className="console-kpi-card">
            <p className="console-kpi-label">Recent tasks</p>
            <p className="console-kpi-value">{data.recent_tasks.length}</p>
          </article>
          <article className="console-kpi-card">
            <p className="console-kpi-label">Recent webhooks</p>
            <p className="console-kpi-value">{data.recent_webhooks.length}</p>
          </article>
        </div>
      </section>

      <section className="console-section">
        <div className="console-section-header">
          <div>
            <h2>Tenants</h2>
            <p className="subtle-text">Each calendar is a billable connection with its own secrets and mirrored inventory.</p>
          </div>
        </div>

        <div className="console-card-grid">
          {data.tenants.map((entry) => (
            <article className="console-detail-card" key={entry.tenant.tenant_id}>
              <p className="console-kpi-label">{entry.tenant.status}</p>
              <h3>{entry.tenant.name}</h3>
              <p className="subtle-text">{entry.tenant.contact_email}</p>
              <p className="subtle-text">
                {entry.active_calendar_count} active calendars · {entry.open_registration_tasks} queued tasks · {entry.dead_letter_tasks} dead letters
              </p>
              <div className="button-row">
                <Link className="button button-secondary button-small" href={`/ops/tenants/${encodeURIComponent(entry.tenant.tenant_id)}/dashboard`}>
                  Dashboard
                </Link>
                <Link className="button button-secondary button-small" href={`/ops/tenants/${encodeURIComponent(entry.tenant.tenant_id)}`}>
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
