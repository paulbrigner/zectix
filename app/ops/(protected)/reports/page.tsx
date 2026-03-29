import {
  createBillingAdjustmentAction,
  updateBillingCycleStatusAction,
} from "@/app/ops/actions";
import { LocalDateTime } from "@/components/LocalDateTime";
import { getBillingReportRows } from "@/lib/billing/usage-ledger";
import {
  billingPeriodForTimestamp,
  formatZecAmount,
  nowIso,
} from "@/lib/app-state/utils";

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
          <h2>Billing cycles</h2>
          <p className="subtle-text">Monthly ZEC billing by tenant, including outstanding balances, cycle state, and manual adjustments.</p>
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
        {rows.length ? (
          rows.map((row) => (
            <article className="console-detail-card" key={row.billing_cycle_id}>
              <p className="console-kpi-label">{row.status}</p>
              <h3>{row.tenant_name}</h3>
              <p className="subtle-text">
                Cycle {row.billing_period} · <LocalDateTime iso={row.period_start} /> to{" "}
                <LocalDateTime iso={row.period_end} />
              </p>
              <p className="subtle-text">
                Outstanding {formatZecAmount(row.outstanding_zatoshis)} · fee total {formatZecAmount(row.service_fee_zatoshis)}
              </p>
              <p className="subtle-text">
                Volume {formatZecAmount(row.gross_zatoshis)} · {row.session_count} recognized registration{row.session_count === 1 ? "" : "s"}
              </p>
              <p className="subtle-text">
                Credits {formatZecAmount(row.credited_zatoshis)} · waivers {formatZecAmount(row.waived_zatoshis)}
              </p>

              <form action={updateBillingCycleStatusAction} className="console-content">
                <input name="billing_cycle_id" type="hidden" value={row.billing_cycle_id} />
                <input name="redirect_to" type="hidden" value={`/ops/reports?billing_period=${encodeURIComponent(billingPeriod)}`} />
                <div className="public-field-grid">
                  <label className="console-field">
                    <span>Status</span>
                    <select className="console-input" defaultValue={row.status} name="status">
                      <option value="open">open</option>
                      <option value="invoiced">invoiced</option>
                      <option value="paid">paid</option>
                      <option value="past_due">past_due</option>
                      <option value="suspended">suspended</option>
                      <option value="carried_over">carried_over</option>
                    </select>
                  </label>
                  <label className="console-field">
                    <span>Invoice reference</span>
                    <input className="console-input" name="invoice_reference" type="text" />
                  </label>
                  <label className="console-field">
                    <span>Settlement txid</span>
                    <input className="console-input" name="settlement_txid" type="text" />
                  </label>
                </div>
                <button className="button button-secondary button-small" type="submit">
                  Update cycle
                </button>
              </form>

              <form action={createBillingAdjustmentAction} className="console-content">
                <input name="billing_cycle_id" type="hidden" value={row.billing_cycle_id} />
                <input name="redirect_to" type="hidden" value={`/ops/reports?billing_period=${encodeURIComponent(billingPeriod)}`} />
                <div className="public-field-grid">
                  <label className="console-field">
                    <span>Adjustment type</span>
                    <select className="console-input" defaultValue="credit" name="type">
                      <option value="credit">credit</option>
                      <option value="waiver">waiver</option>
                    </select>
                  </label>
                  <label className="console-field">
                    <span>Amount (zatoshis)</span>
                    <input className="console-input" name="amount_zatoshis" type="number" />
                  </label>
                  <label className="console-field">
                    <span>Reason</span>
                    <input className="console-input" name="reason" type="text" />
                  </label>
                </div>
                <button className="button button-secondary button-small" type="submit">
                  Add adjustment
                </button>
              </form>
            </article>
          ))
        ) : (
          <article className="console-detail-card">
            <h3>No billing cycles for this period</h3>
            <p className="subtle-text">
              Cycles appear once a tenant has recognized ZEC-billable registrations in the selected month.
            </p>
          </article>
        )}
      </div>
    </section>
  );
}
