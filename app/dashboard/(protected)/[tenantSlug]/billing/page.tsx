import { notFound } from "next/navigation";
import { LocalDateTime } from "@/components/LocalDateTime";
import { formatZecAmount } from "@/lib/app-state/utils";
import { requireTenantPageAccess } from "@/lib/tenant-auth-server";
import { getTenantSelfServeDetailBySlug } from "@/lib/tenancy/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function TenantBillingPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const email = await requireTenantPageAccess();
  const { tenantSlug } = await params;
  const detail = await getTenantSelfServeDetailBySlug(tenantSlug, email);
  if (!detail) {
    notFound();
  }

  const billing = detail.billing;

  return (
    <div className="console-page-body">
      <section className="console-section">
        <div className="console-section-header">
          <div>
            <h2>Billing</h2>
            <p className="subtle-text">
              Platform fees accrue in ZEC when a paid registration is successfully mirrored into Luma. Cycles close monthly and stay separate from public-checkout activation.
            </p>
          </div>
        </div>

        <div className="console-kpi-grid">
          <article className="console-kpi-card">
            <p className="console-kpi-label">Billing status</p>
            <p className="console-kpi-value">{detail.tenant.billing_status}</p>
            <p className="subtle-text console-kpi-detail">
              Grace window {detail.tenant.billing_grace_days} day{detail.tenant.billing_grace_days === 1 ? "" : "s"}
            </p>
          </article>
          <article className="console-kpi-card">
            <p className="console-kpi-label">Service fee</p>
            <p className="console-kpi-value">{detail.tenant.service_fee_bps} bps</p>
            <p className="subtle-text console-kpi-detail">Applied when a new CipherPay invoice is created.</p>
          </article>
          <article className="console-kpi-card">
            <p className="console-kpi-label">Current outstanding</p>
            <p className="console-kpi-value">
              {formatZecAmount(billing?.current_cycle?.outstanding_zatoshis || 0)}
            </p>
            <p className="subtle-text console-kpi-detail">
              Settlement threshold {formatZecAmount(detail.tenant.settlement_threshold_zatoshis)}
            </p>
          </article>
          <article className="console-kpi-card">
            <p className="console-kpi-label">Current cycle</p>
            <p className="console-kpi-value">{billing?.current_cycle?.billing_period || "n/a"}</p>
            <p className="subtle-text console-kpi-detail">
              {billing?.current_cycle ? (
                <>
                  <LocalDateTime iso={billing.current_cycle.period_start} /> to{" "}
                  <LocalDateTime iso={billing.current_cycle.period_end} />
                </>
              ) : (
                "A cycle appears once billing is initialized for this organizer."
              )}
            </p>
          </article>
        </div>
      </section>

      <section className="console-section">
        <div className="console-section-header">
          <div>
            <h2>Cycle history</h2>
            <p className="subtle-text">
              Credits and waivers appear below the cycle they affected. Settlement references and txids are operator-managed for now.
            </p>
          </div>
        </div>

        <div className="console-card-grid">
          {billing?.cycles.length ? (
            billing.cycles.map((cycle) => {
              const adjustments = billing.adjustments_by_cycle.get(cycle.billing_cycle_id) || [];
              return (
                <article className="console-detail-card" key={cycle.billing_cycle_id}>
                  <p className="console-kpi-label">{cycle.status}</p>
                  <h3>{cycle.billing_period}</h3>
                  <p className="subtle-text">
                    Outstanding {formatZecAmount(cycle.outstanding_zatoshis)} · fee total {formatZecAmount(cycle.service_fee_zatoshis)}
                  </p>
                  <p className="subtle-text">
                    Volume {formatZecAmount(cycle.gross_zatoshis)} · {cycle.recognized_session_count} recognized registration{cycle.recognized_session_count === 1 ? "" : "s"}
                  </p>
                  <p className="subtle-text">
                    Credits {formatZecAmount(cycle.credited_zatoshis)} · waivers {formatZecAmount(cycle.waived_zatoshis)}
                  </p>
                  <p className="subtle-text">
                    Grace until <LocalDateTime iso={cycle.grace_until} />
                  </p>
                  {cycle.invoice_reference ? (
                    <p className="subtle-text">Invoice reference {cycle.invoice_reference}</p>
                  ) : null}
                  {cycle.settlement_txid ? (
                    <p className="subtle-text">Settlement txid {cycle.settlement_txid}</p>
                  ) : null}
                  {adjustments.length ? (
                    <div className="console-preview-list console-preview-list-compact">
                      {adjustments.map((adjustment) => (
                        <article
                          className="console-preview-card console-preview-card-compact"
                          key={adjustment.adjustment_id}
                        >
                          <div className="console-preview-body">
                            <div className="console-preview-body-head">
                              <div>
                                <p className="console-kpi-label">{adjustment.type}</p>
                                <strong>{formatZecAmount(adjustment.amount_zatoshis)}</strong>
                              </div>
                            </div>
                            <p className="subtle-text">{adjustment.reason}</p>
                            <p className="subtle-text">
                              Added <LocalDateTime iso={adjustment.created_at} />
                            </p>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })
          ) : (
            <article className="console-detail-card">
              <h3>No billing cycles yet</h3>
              <p className="subtle-text">
                A cycle is created automatically once a paid registration is recognized for this tenant.
              </p>
            </article>
          )}
        </div>
      </section>
    </div>
  );
}
