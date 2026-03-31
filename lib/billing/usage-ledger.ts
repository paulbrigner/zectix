import { randomUUID } from "node:crypto";
import {
  buildBillingReportRows,
  getBillingCycle,
  getTenant,
  getUsageLedgerEntryBySession,
  listBillingAdjustmentsByCycle,
  listBillingCyclesByTenant,
  listSessionsByTenant,
  listTenants,
  listUsageLedgerEntriesByTenantCycle,
  putBillingAdjustment,
  putBillingCycle,
  putUsageLedgerEntry,
  putUsageLedgerEntryIfAbsent,
  updateBillingCycle,
} from "@/lib/app-state/state";
import type {
  BillingAdjustment,
  BillingAdjustmentType,
  BillingCycle,
  BillingReportRow,
  CheckoutSession,
  UsageLedgerEntry,
} from "@/lib/app-state/types";
import {
  billingWindowForPeriod,
  buildBillingCycleId,
  calculateOutstandingZatoshis,
  deriveBillingCycleStatus,
  isBillingCycleCurrent,
  summarizeBillingAdjustments,
} from "@/lib/billing/cycles";
import {
  billingPeriodForTimestamp,
  calculateServiceFeeZatoshis,
  nowIso,
  zatoshisToZec,
  zecToZatoshis,
} from "@/lib/app-state/utils";

function buildBillingCycleRecord(
  tenantId: string,
  billingPeriod: string,
  graceDays: number,
): BillingCycle {
  const timestamp = nowIso();
  const window = billingWindowForPeriod(billingPeriod, graceDays);
  return {
    billing_cycle_id: buildBillingCycleId(tenantId, billingPeriod),
    tenant_id: tenantId,
    billing_period: billingPeriod,
    period_start: window.period_start,
    period_end: window.period_end,
    grace_until: window.grace_until,
    status: "open",
    recognized_session_count: 0,
    gross_zatoshis: 0,
    service_fee_zatoshis: 0,
    credited_zatoshis: 0,
    waived_zatoshis: 0,
    outstanding_zatoshis: 0,
    invoice_reference: null,
    settlement_txid: null,
    invoiced_at: null,
    paid_at: null,
    last_reconciled_at: null,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

async function saveUsageLedgerEntryForExistingSession(
  existing: UsageLedgerEntry,
  session: CheckoutSession,
) {
  const grossZatoshis =
    existing.gross_zatoshis ||
    session.cipherpay_price_zatoshis ||
    zecToZatoshis(session.cipherpay_price_zec) ||
    0;
  const serviceFeeZatoshis =
    existing.service_fee_zatoshis ||
    session.service_fee_zatoshis_snapshot ||
    calculateServiceFeeZatoshis(grossZatoshis, session.service_fee_bps_snapshot);
  const cycle = await ensureBillingCycleForTenant(
    existing.tenant_id,
    existing.billing_period,
  );
  const nextEntry: UsageLedgerEntry = {
    ...existing,
    gross_zatoshis: grossZatoshis,
    service_fee_bps: session.service_fee_bps_snapshot,
    service_fee_zatoshis: serviceFeeZatoshis,
    billing_cycle_id: cycle.billing_cycle_id,
  };
  const saved = await putUsageLedgerEntry(nextEntry);
  await reconcileBillingCycle(saved.billing_cycle_id);
  return saved;
}

async function ensureBillingCycleForTenant(tenantId: string, billingPeriod: string) {
  const tenant = await getTenant(tenantId);
  if (!tenant) {
    throw new Error(`Tenant ${tenantId} was not found.`);
  }

  const billingCycleId = buildBillingCycleId(tenantId, billingPeriod);
  const existing = await getBillingCycle(billingCycleId);
  if (existing) {
    return existing;
  }

  return putBillingCycle(
    buildBillingCycleRecord(tenantId, billingPeriod, tenant.billing_grace_days),
  );
}

export async function reconcileBillingCycle(billingCycleId: string) {
  const cycle = await getBillingCycle(billingCycleId);
  if (!cycle) {
    throw new Error(`Billing cycle ${billingCycleId} was not found.`);
  }

  const tenant = await getTenant(cycle.tenant_id);
  if (!tenant) {
    throw new Error(`Tenant ${cycle.tenant_id} was not found.`);
  }

  const [entries, adjustments] = await Promise.all([
    listUsageLedgerEntriesByTenantCycle(cycle.tenant_id, cycle.billing_cycle_id),
    listBillingAdjustmentsByCycle(cycle.billing_cycle_id),
  ]);

  const legacyCredits = entries
    .filter((entry) => entry.status === "credited")
    .reduce((sum, entry) => sum + entry.service_fee_zatoshis, 0);
  const legacyWaivers = entries
    .filter((entry) => entry.status === "waived")
    .reduce((sum, entry) => sum + entry.service_fee_zatoshis, 0);
  const adjustmentTotals = summarizeBillingAdjustments(adjustments);
  const serviceFeeZatoshis = entries.reduce((sum, entry) => sum + entry.service_fee_zatoshis, 0);
  const nextCycle: BillingCycle = {
    ...cycle,
    status: deriveBillingCycleStatus(cycle, tenant.billing_status),
    recognized_session_count: entries.length,
    gross_zatoshis: entries.reduce((sum, entry) => sum + entry.gross_zatoshis, 0),
    service_fee_zatoshis: serviceFeeZatoshis,
    credited_zatoshis: legacyCredits + adjustmentTotals.credited_zatoshis,
    waived_zatoshis: legacyWaivers + adjustmentTotals.waived_zatoshis,
    outstanding_zatoshis: 0,
    last_reconciled_at: nowIso(),
    updated_at: nowIso(),
  };
  nextCycle.outstanding_zatoshis = calculateOutstandingZatoshis({
    service_fee_zatoshis: nextCycle.service_fee_zatoshis,
    credited_zatoshis: nextCycle.credited_zatoshis,
    waived_zatoshis: nextCycle.waived_zatoshis,
  });
  nextCycle.status = deriveBillingCycleStatus(nextCycle, tenant.billing_status);

  return putBillingCycle(nextCycle);
}

export async function ensureUsageLedgerEntryForSession(session: CheckoutSession) {
  const existing = await getUsageLedgerEntryBySession(session.session_id);
  if (existing) {
    return saveUsageLedgerEntryForExistingSession(existing, session);
  }

  const recognizedAt = session.registered_at || session.confirmed_at || nowIso();
  const billingPeriod = billingPeriodForTimestamp(recognizedAt);
  const cycle = await ensureBillingCycleForTenant(session.tenant_id, billingPeriod);
  const grossZatoshis =
    session.cipherpay_price_zatoshis || zecToZatoshis(session.cipherpay_price_zec) || 0;
  const entry: UsageLedgerEntry = {
    usage_entry_id: randomUUID(),
    tenant_id: session.tenant_id,
    calendar_connection_id: session.calendar_connection_id,
    session_id: session.session_id,
    cipherpay_invoice_id: session.cipherpay_invoice_id,
    event_api_id: session.event_api_id,
    gross_zatoshis: grossZatoshis,
    service_fee_bps: session.service_fee_bps_snapshot,
    service_fee_zatoshis:
      session.service_fee_zatoshis_snapshot ||
      calculateServiceFeeZatoshis(grossZatoshis, session.service_fee_bps_snapshot),
    recognized_at: recognizedAt,
    billing_period: billingPeriod,
    billing_cycle_id: cycle.billing_cycle_id,
    status: "billable",
  };

  let saved: UsageLedgerEntry;
  try {
    saved = await putUsageLedgerEntryIfAbsent(entry);
  } catch (error) {
    if (error instanceof Error && error.name === "UsageLedgerSessionConflictError") {
      const existingAfterConflict = await getUsageLedgerEntryBySession(
        session.session_id,
      );
      if (existingAfterConflict) {
        return saveUsageLedgerEntryForExistingSession(
          existingAfterConflict,
          session,
        );
      }
    }

    throw error;
  }
  await reconcileBillingCycle(cycle.billing_cycle_id);
  return saved;
}

export async function listTenantBillingCycles(tenantId: string) {
  const tenant = await getTenant(tenantId);
  if (!tenant) {
    return [] as BillingCycle[];
  }

  const cycles = await listBillingCyclesByTenant(tenantId);
  const reconciled = await Promise.all(cycles.map((cycle) => reconcileBillingCycle(cycle.billing_cycle_id)));
  return reconciled.sort(
    (left, right) =>
      new Date(right.period_start).getTime() - new Date(left.period_start).getTime(),
  );
}

export async function getTenantBillingSnapshot(tenantId: string) {
  const tenant = await getTenant(tenantId);
  if (!tenant) {
    return null;
  }

  const sessions = await listSessionsByTenant(tenantId, 200);
  await Promise.all(
    sessions
      .filter(
        (session) =>
          session.registration_status === "registered" ||
          Boolean(session.registered_at) ||
          Boolean(session.confirmed_at),
      )
      .map((session) => ensureUsageLedgerEntryForSession(session)),
  );

  const currentPeriod = billingPeriodForTimestamp(nowIso());
  await ensureBillingCycleForTenant(tenantId, currentPeriod);
  const cycles = await listTenantBillingCycles(tenantId);
  const adjustmentsByCycle = new Map<string, BillingAdjustment[]>(
    await Promise.all(
      cycles.map(
        async (cycle): Promise<readonly [string, BillingAdjustment[]]> =>
          [
            cycle.billing_cycle_id,
            await listBillingAdjustmentsByCycle(cycle.billing_cycle_id),
          ] as const,
      ),
    ),
  );

  return {
    tenant,
    current_cycle:
      cycles.find((cycle) => isBillingCycleCurrent(cycle)) ||
      cycles.find((cycle) => cycle.billing_period === currentPeriod) ||
      cycles[0] ||
      null,
    cycles,
    adjustments_by_cycle: adjustmentsByCycle,
  };
}

export async function createBillingAdjustment(input: {
  billing_cycle_id: string;
  type: BillingAdjustmentType;
  amount_zatoshis: number;
  reason: string;
}) {
  if (input.amount_zatoshis <= 0) {
    throw new Error("Billing adjustments must be greater than zero zatoshis.");
  }

  if (!input.reason.trim()) {
    throw new Error("A billing adjustment reason is required.");
  }

  const cycle = await getBillingCycle(input.billing_cycle_id);
  if (!cycle) {
    throw new Error(`Billing cycle ${input.billing_cycle_id} was not found.`);
  }

  const adjustment: BillingAdjustment = {
    adjustment_id: randomUUID(),
    billing_cycle_id: input.billing_cycle_id,
    tenant_id: cycle.tenant_id,
    type: input.type,
    amount_zatoshis: input.amount_zatoshis,
    reason: input.reason.trim(),
    created_at: nowIso(),
  };

  await putBillingAdjustment(adjustment);
  await reconcileBillingCycle(input.billing_cycle_id);
  return adjustment;
}

export async function updateBillingCycleState(input: {
  billing_cycle_id: string;
  status: BillingCycle["status"];
  invoice_reference?: string | null;
  settlement_txid?: string | null;
}) {
  const patch: Partial<BillingCycle> = {
    status: input.status,
  };
  const timestamp = nowIso();

  if (input.status === "invoiced") {
    patch.invoiced_at = timestamp;
    patch.invoice_reference = input.invoice_reference?.trim() || null;
    patch.paid_at = null;
    patch.settlement_txid = null;
  } else if (input.status === "paid") {
    patch.paid_at = timestamp;
    patch.settlement_txid = input.settlement_txid?.trim() || null;
    if (input.invoice_reference?.trim()) {
      patch.invoice_reference = input.invoice_reference.trim();
    }
  } else if (input.status === "open") {
    patch.invoiced_at = null;
    patch.paid_at = null;
    patch.invoice_reference = null;
    patch.settlement_txid = null;
  } else if (input.status === "carried_over") {
    patch.paid_at = null;
    patch.settlement_txid = null;
  }

  await updateBillingCycle(input.billing_cycle_id, patch);
  return reconcileBillingCycle(input.billing_cycle_id);
}

export async function getBillingReportRows(billingPeriod: string) {
  const tenants = await listTenants();
  await Promise.all(tenants.map((tenant) => getTenantBillingSnapshot(tenant.tenant_id)));
  return buildBillingReportRows(billingPeriod);
}

function csvEscape(value: string | number) {
  const text = String(value);
  if (!text.includes(",") && !text.includes("\"") && !text.includes("\n")) {
    return text;
  }

  return `"${text.replaceAll("\"", "\"\"")}"`;
}

export function renderBillingReportCsv(rows: BillingReportRow[]) {
  const header = [
    "tenant_id",
    "tenant_name",
    "billing_cycle_id",
    "billing_period",
    "period_start",
    "period_end",
    "status",
    "session_count",
    "gross_zec",
    "service_fee_zec",
    "credited_zec",
    "waived_zec",
    "outstanding_zec",
  ];

  const body = rows.map((row) =>
    [
      row.tenant_id,
      row.tenant_name,
      row.billing_cycle_id,
      row.billing_period,
      row.period_start,
      row.period_end,
      row.status,
      row.session_count,
      (zatoshisToZec(row.gross_zatoshis) || 0).toFixed(8),
      (zatoshisToZec(row.service_fee_zatoshis) || 0).toFixed(8),
      (zatoshisToZec(row.credited_zatoshis) || 0).toFixed(8),
      (zatoshisToZec(row.waived_zatoshis) || 0).toFixed(8),
      (zatoshisToZec(row.outstanding_zatoshis) || 0).toFixed(8),
    ]
      .map(csvEscape)
      .join(","),
  );

  return [header.join(","), ...body].join("\n");
}
