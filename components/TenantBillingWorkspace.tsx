import { LocalDateTime } from "@/components/LocalDateTime";
import { ConsoleDisclosure } from "@/components/ConsoleDisclosure";
import type { BillingAdjustment, BillingCycle } from "@/lib/app-state/types";
import { formatZecAmount } from "@/lib/app-state/utils";
import type { TenantOpsDetail } from "@/lib/tenancy/service";

type BillingTone = "success" | "warning" | "danger" | "info" | "muted";

function humanizeBillingLabel(value: string) {
  return value.replaceAll("_", " ");
}

function billingTone(value: string): BillingTone {
  switch (value) {
    case "active":
    case "paid":
      return "success";
    case "open":
      return "info";
    case "invoiced":
      return "warning";
    case "past_due":
    case "suspended":
      return "danger";
    case "carried_over":
      return "muted";
    default:
      return "muted";
  }
}

function pillClassName(tone: BillingTone) {
  return `console-mini-pill console-mini-pill-${tone}`;
}

function settlementSummary(cycle: BillingCycle | null) {
  if (!cycle) {
    return "A billing cycle will appear after the first recognized paid registration.";
  }

  if (cycle.settlement_txid) {
    return `Settlement txid ${cycle.settlement_txid}`;
  }

  if (cycle.invoice_reference) {
    return `Invoice reference ${cycle.invoice_reference}`;
  }

  if (cycle.status === "invoiced") {
    return "Invoice issued and awaiting settlement.";
  }

  if (cycle.status === "paid") {
    return "Marked paid. No on-chain settlement reference was recorded.";
  }

  if (cycle.status === "past_due") {
    return "Cycle is past due and still has an outstanding balance.";
  }

  if (cycle.status === "suspended") {
    return "Cycle is suspended pending operator follow-up.";
  }

  return "Operator-managed settlement details will appear here once a cycle is invoiced.";
}

function outstandingSummary(
  outstandingZatoshis: number,
  settlementThresholdZatoshis: number,
) {
  if (outstandingZatoshis <= 0) {
    return "No balance is currently due.";
  }

  if (outstandingZatoshis >= settlementThresholdZatoshis) {
    return "Settlement threshold reached.";
  }

  return `${formatZecAmount(settlementThresholdZatoshis - outstandingZatoshis)} until the threshold.`;
}

function adjustmentSummary(cycle: BillingCycle) {
  const total = cycle.credited_zatoshis + cycle.waived_zatoshis;
  if (total <= 0) {
    return "No credits or waivers recorded";
  }

  return `${formatZecAmount(total)} in credits and waivers`;
}

function renderAdjustmentList(adjustments: BillingAdjustment[]) {
  if (!adjustments.length) {
    return (
      <p className="subtle-text">
        No manual credits or waivers were recorded for this cycle.
      </p>
    );
  }

  return (
    <div className="billing-adjustment-list">
      {adjustments.map((adjustment) => (
        <article className="console-detail-card billing-adjustment-card" key={adjustment.adjustment_id}>
          <div className="billing-adjustment-head">
            <div>
              <p className="console-kpi-label">{adjustment.type}</p>
              <strong>{formatZecAmount(adjustment.amount_zatoshis)}</strong>
            </div>
            <span className={pillClassName(adjustment.type === "credit" ? "info" : "warning")}>
              {humanizeBillingLabel(adjustment.type)}
            </span>
          </div>
          <p className="subtle-text">{adjustment.reason}</p>
          <p className="subtle-text">
            Added <LocalDateTime iso={adjustment.created_at} />
          </p>
        </article>
      ))}
    </div>
  );
}

export function TenantBillingWorkspace({
  detail,
  tenantBasePath: _tenantBasePath,
}: {
  detail: TenantOpsDetail;
  tenantBasePath: string;
}) {
  const billing = detail.billing;
  const cycles = billing?.cycles || [];
  const currentCycle = billing?.current_cycle || null;
  const currentAdjustments =
    currentCycle && billing
      ? billing.adjustments_by_cycle.get(currentCycle.billing_cycle_id) || []
      : [];
  const historyCycles = currentCycle
    ? cycles.filter((cycle) => cycle.billing_cycle_id !== currentCycle.billing_cycle_id)
    : cycles;
  const currentOutstanding = currentCycle?.outstanding_zatoshis || 0;

  return (
    <div className="console-page-body">
      <section className="console-section">
        <div className="console-section-header">
          <div>
            <h2>Billing</h2>
            <p className="subtle-text">
              ZEC-native platform fees accrue when a paid registration is recognized in Luma. Billing cycles stay separate from public checkout visibility and settlement is still operator-managed.
            </p>
          </div>
        </div>

        <div className="billing-summary-grid">
          <article className="console-detail-card billing-summary-card billing-summary-card-accent">
            <p className="console-kpi-label">Current balance</p>
            <h3>{formatZecAmount(currentOutstanding)}</h3>
            <p className="subtle-text">
              {outstandingSummary(
                currentOutstanding,
                detail.tenant.settlement_threshold_zatoshis,
              )}
            </p>
            <div className="console-mini-pill-row">
              <span className={pillClassName(billingTone(detail.tenant.billing_status))}>
                {humanizeBillingLabel(detail.tenant.billing_status)}
              </span>
              <span className={pillClassName(currentOutstanding > 0 ? "warning" : "success")}>
                threshold {formatZecAmount(detail.tenant.settlement_threshold_zatoshis)}
              </span>
            </div>
          </article>

          <article className="console-detail-card billing-summary-card">
            <p className="console-kpi-label">Current cycle</p>
            <h3>{currentCycle?.billing_period || "Waiting for first cycle"}</h3>
            <p className="subtle-text">
              {currentCycle ? (
                <>
                  <LocalDateTime iso={currentCycle.period_start} /> to{" "}
                  <LocalDateTime iso={currentCycle.period_end} />
                </>
              ) : (
                "A cycle appears automatically after the first recognized billable registration."
              )}
            </p>
            {currentCycle ? (
              <span className={pillClassName(billingTone(currentCycle.status))}>
                {humanizeBillingLabel(currentCycle.status)}
              </span>
            ) : null}
          </article>

          <article className="console-detail-card billing-summary-card">
            <p className="console-kpi-label">Service fee</p>
            <h3>{detail.tenant.service_fee_bps} bps</h3>
            <p className="subtle-text">
              Applied when a new CipherPay invoice is created and carried into the usage ledger at recognition time.
            </p>
          </article>
        </div>
      </section>

      <section className="console-section">
        <div className="console-section-header">
          <div>
            <h2>Current cycle</h2>
            <p className="subtle-text">
              A quick view of the live cycle, including balance breakdown, settlement notes, and manual adjustments.
            </p>
          </div>
        </div>

        {currentCycle ? (
          <>
            <div className="console-signal-grid billing-cycle-signal-grid">
              <div className="console-signal-card">
                <span className="console-kpi-label">Recognized registrations</span>
                <strong>{currentCycle.recognized_session_count}</strong>
                <p className="subtle-text">
                  Paid attendee registration{currentCycle.recognized_session_count === 1 ? "" : "s"} mirrored successfully this cycle
                </p>
              </div>
              <div className="console-signal-card">
                <span className="console-kpi-label">Fee total</span>
                <strong>{formatZecAmount(currentCycle.service_fee_zatoshis)}</strong>
                <p className="subtle-text">
                  Gross volume {formatZecAmount(currentCycle.gross_zatoshis)}
                </p>
              </div>
              <div className="console-signal-card">
                <span className="console-kpi-label">Adjustments</span>
                <strong>
                  {formatZecAmount(
                    currentCycle.credited_zatoshis + currentCycle.waived_zatoshis,
                  )}
                </strong>
                <p className="subtle-text">{adjustmentSummary(currentCycle)}</p>
              </div>
              <div className="console-signal-card">
                <span className="console-kpi-label">Settlement</span>
                <strong>{humanizeBillingLabel(currentCycle.status)}</strong>
                <p className="subtle-text">{settlementSummary(currentCycle)}</p>
              </div>
            </div>

            <div className="billing-cycle-detail-grid">
              <article className="console-detail-card billing-breakdown-card">
                <p className="console-kpi-label">Balance breakdown</p>
                <dl className="billing-breakdown-list">
                  <div>
                    <dt>Gross volume</dt>
                    <dd>{formatZecAmount(currentCycle.gross_zatoshis)}</dd>
                  </div>
                  <div>
                    <dt>Service fees</dt>
                    <dd>{formatZecAmount(currentCycle.service_fee_zatoshis)}</dd>
                  </div>
                  <div>
                    <dt>Credits</dt>
                    <dd>{formatZecAmount(currentCycle.credited_zatoshis)}</dd>
                  </div>
                  <div>
                    <dt>Waivers</dt>
                    <dd>{formatZecAmount(currentCycle.waived_zatoshis)}</dd>
                  </div>
                  <div className="billing-breakdown-total">
                    <dt>Outstanding</dt>
                    <dd>{formatZecAmount(currentCycle.outstanding_zatoshis)}</dd>
                  </div>
                </dl>
              </article>

              <article className="console-detail-card billing-cycle-meta-card">
                <p className="console-kpi-label">Cycle details</p>
                <dl className="tenant-summary-list billing-cycle-meta-list">
                  <div>
                    <dt>Cycle window</dt>
                    <dd>
                      <LocalDateTime iso={currentCycle.period_start} /> to{" "}
                      <LocalDateTime iso={currentCycle.period_end} />
                    </dd>
                  </div>
                  <div>
                    <dt>Grace window</dt>
                    <dd>
                      Until <LocalDateTime iso={currentCycle.grace_until} />
                    </dd>
                  </div>
                  <div>
                    <dt>Invoice reference</dt>
                    <dd>{currentCycle.invoice_reference || "Not recorded yet"}</dd>
                  </div>
                  <div>
                    <dt>Settlement txid</dt>
                    <dd>{currentCycle.settlement_txid || "Not recorded yet"}</dd>
                  </div>
                  <div>
                    <dt>Last reconciled</dt>
                    <dd>
                      {currentCycle.last_reconciled_at ? (
                        <LocalDateTime iso={currentCycle.last_reconciled_at} />
                      ) : (
                        "Not reconciled yet"
                      )}
                    </dd>
                  </div>
                </dl>
              </article>
            </div>

            <ConsoleDisclosure
              description={`${currentAdjustments.length} adjustment${currentAdjustments.length === 1 ? "" : "s"} recorded for the current cycle.`}
              title="Current cycle adjustments"
            >
              {renderAdjustmentList(currentAdjustments)}
            </ConsoleDisclosure>
          </>
        ) : (
          <div className="console-preview-empty">
            <strong>No billing cycle yet</strong>
            <p className="subtle-text">
              Billing activity will appear here after the first paid registration is recognized in the managed checkout flow.
            </p>
          </div>
        )}
      </section>

      <section className="console-section">
        <div className="console-section-header">
          <div>
            <h2>Cycle history</h2>
            <p className="subtle-text">
              Previous cycles stay collapsed until you need their settlement references, adjustments, or period details.
            </p>
          </div>
        </div>

        {!historyCycles.length ? (
          <div className="console-preview-empty">
            <strong>No previous billing cycles yet</strong>
            <p className="subtle-text">
              Older cycles will collect here automatically once the current cycle rolls forward.
            </p>
          </div>
        ) : (
          <div className="billing-history-list">
            {historyCycles.map((cycle) => {
              const adjustments =
                billing?.adjustments_by_cycle.get(cycle.billing_cycle_id) || [];
              return (
                <ConsoleDisclosure
                  className="billing-history-card"
                  description={`${formatZecAmount(cycle.outstanding_zatoshis)} outstanding · ${formatZecAmount(cycle.service_fee_zatoshis)} fee total · ${cycle.recognized_session_count} recognized registration${cycle.recognized_session_count === 1 ? "" : "s"}`}
                  key={cycle.billing_cycle_id}
                  title={`${cycle.billing_period} · ${humanizeBillingLabel(cycle.status)}`}
                >
                  <div className="console-signal-grid billing-history-signal-grid">
                    <div className="console-signal-card">
                      <span className="console-kpi-label">Cycle window</span>
                      <strong>
                        <LocalDateTime iso={cycle.period_start} />
                      </strong>
                      <p className="subtle-text">
                        through <LocalDateTime iso={cycle.period_end} />
                      </p>
                    </div>
                    <div className="console-signal-card">
                      <span className="console-kpi-label">Gross volume</span>
                      <strong>{formatZecAmount(cycle.gross_zatoshis)}</strong>
                      <p className="subtle-text">
                        Fee total {formatZecAmount(cycle.service_fee_zatoshis)}
                      </p>
                    </div>
                    <div className="console-signal-card">
                      <span className="console-kpi-label">Outstanding</span>
                      <strong>{formatZecAmount(cycle.outstanding_zatoshis)}</strong>
                      <p className="subtle-text">
                        {adjustmentSummary(cycle)}
                      </p>
                    </div>
                    <div className="console-signal-card">
                      <span className="console-kpi-label">Settlement</span>
                      <strong>{humanizeBillingLabel(cycle.status)}</strong>
                      <p className="subtle-text">{settlementSummary(cycle)}</p>
                    </div>
                  </div>

                  <dl className="tenant-summary-list billing-cycle-meta-list">
                    <div>
                      <dt>Grace window</dt>
                      <dd>
                        Until <LocalDateTime iso={cycle.grace_until} />
                      </dd>
                    </div>
                    <div>
                      <dt>Invoice reference</dt>
                      <dd>{cycle.invoice_reference || "Not recorded"}</dd>
                    </div>
                    <div>
                      <dt>Settlement txid</dt>
                      <dd>{cycle.settlement_txid || "Not recorded"}</dd>
                    </div>
                    <div>
                      <dt>Last reconciled</dt>
                      <dd>
                        {cycle.last_reconciled_at ? (
                          <LocalDateTime iso={cycle.last_reconciled_at} />
                        ) : (
                          "Not reconciled yet"
                        )}
                      </dd>
                    </div>
                  </dl>

                  {adjustments.length ? (
                    <ConsoleDisclosure
                      description={`${adjustments.length} adjustment${adjustments.length === 1 ? "" : "s"} recorded for this cycle.`}
                      title="Adjustments"
                    >
                      {renderAdjustmentList(adjustments)}
                    </ConsoleDisclosure>
                  ) : null}
                </ConsoleDisclosure>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
