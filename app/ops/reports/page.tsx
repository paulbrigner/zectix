import { getBillingReportRows } from "@/lib/billing/usage-ledger";
import { billingPeriodForTimestamp, nowIso } from "@/lib/app-state/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ billing_period?: string }>;
}) {
  const { billing_period } = await searchParams;
  const billingPeriod = billing_period || billingPeriodForTimestamp(nowIso());
  const rows = await getBillingReportRows(billingPeriod);

  return (
    <section className="console-section">
      <div className="console-section-header">
        <div>
          <h2>Billing reports</h2>
          <p className="subtle-text">Monthly billable volume and service-fee due by tenant and calendar connection.</p>
        </div>
        <a className="button button-secondary button-small" href={`/api/ops/reports?billing_period=${encodeURIComponent(billingPeriod)}&format=csv`}>
          Export CSV
        </a>
      </div>

      <form className="button-row" method="get">
        <label className="console-field">
          <span>Billing period</span>
          <input className="console-input" defaultValue={billingPeriod} name="billing_period" pattern="\d{4}-\d{2}" type="text" />
        </label>
        <button className="button button-secondary button-small" type="submit">
          Load report
        </button>
      </form>

      <div className="console-card-grid">
        {rows.map((row) => (
          <article className="console-detail-card" key={`${row.tenant_id}-${row.calendar_connection_id}-${row.currency}`}>
            <p className="console-kpi-label">{row.billing_period}</p>
            <h3>{row.tenant_name}</h3>
            <p className="subtle-text">{row.calendar_display_name}</p>
            <p className="subtle-text">
              {row.session_count} sessions · gross {row.gross_volume.toFixed(2)} {row.currency} · fee due {row.service_fee_due.toFixed(2)} {row.currency}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
