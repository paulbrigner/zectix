import type {
  BillingAdjustment,
  BillingCycle,
  BillingCycleStatus,
  TenantBillingStatus,
} from "@/lib/app-state/types";
import { nowIso } from "@/lib/app-state/utils";

export function buildBillingCycleId(tenantId: string, billingPeriod: string) {
  return `${tenantId}:${billingPeriod}`;
}

export function billingWindowForPeriod(billingPeriod: string, graceDays: number) {
  const [yearText, monthText] = billingPeriod.split("-");
  const year = Number.parseInt(yearText || "", 10);
  const month = Number.parseInt(monthText || "", 10);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    const fallback = nowIso();
    return {
      period_start: fallback,
      period_end: fallback,
      grace_until: fallback,
    };
  }

  const periodStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const periodEnd = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const graceUntil = new Date(
    periodEnd.getTime() + Math.max(0, Math.floor(graceDays)) * 24 * 60 * 60 * 1000,
  );

  return {
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
    grace_until: graceUntil.toISOString(),
  };
}

export function calculateOutstandingZatoshis(input: {
  service_fee_zatoshis: number;
  credited_zatoshis: number;
  waived_zatoshis: number;
}) {
  return Math.max(
    0,
    Math.max(0, input.service_fee_zatoshis) -
      Math.max(0, input.credited_zatoshis) -
      Math.max(0, input.waived_zatoshis),
  );
}

export function summarizeBillingAdjustments(adjustments: BillingAdjustment[]) {
  return adjustments.reduce(
    (summary, adjustment) => {
      if (adjustment.type === "credit") {
        summary.credited_zatoshis += adjustment.amount_zatoshis;
      } else {
        summary.waived_zatoshis += adjustment.amount_zatoshis;
      }

      return summary;
    },
    {
      credited_zatoshis: 0,
      waived_zatoshis: 0,
    },
  );
}

export function deriveBillingCycleStatus(
  cycle: BillingCycle,
  tenantBillingStatus: TenantBillingStatus,
  referenceTime = nowIso(),
): BillingCycleStatus {
  if (cycle.status === "paid" || cycle.paid_at) {
    return "paid";
  }

  if (cycle.status === "carried_over") {
    return cycle.status;
  }

  if (cycle.status === "suspended" || tenantBillingStatus === "suspended") {
    return "suspended";
  }

  if (cycle.status === "past_due" && cycle.outstanding_zatoshis > 0) {
    return "past_due";
  }

  if (cycle.status === "invoiced" && cycle.outstanding_zatoshis > 0) {
    return "invoiced";
  }

  const nowMs = new Date(referenceTime).getTime();
  const graceUntilMs = new Date(cycle.grace_until).getTime();
  if (Number.isFinite(nowMs) && Number.isFinite(graceUntilMs) && nowMs > graceUntilMs) {
    return cycle.outstanding_zatoshis > 0 ? "past_due" : cycle.status;
  }

  if (cycle.invoiced_at || cycle.invoice_reference) {
    return cycle.outstanding_zatoshis > 0 ? "invoiced" : "paid";
  }

  return cycle.status;
}

export function isBillingCycleCurrent(cycle: BillingCycle, referenceTime = nowIso()) {
  const nowMs = new Date(referenceTime).getTime();
  const startMs = new Date(cycle.period_start).getTime();
  const endMs = new Date(cycle.period_end).getTime();
  return Number.isFinite(nowMs) && Number.isFinite(startMs) && Number.isFinite(endMs)
    ? nowMs >= startMs && nowMs < endMs
    : false;
}
