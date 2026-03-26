import { randomUUID } from "node:crypto";
import {
  buildBillingReportRows,
  getUsageLedgerEntryBySession,
  putUsageLedgerEntry,
} from "@/lib/app-state/state";
import type { BillingReportRow, CheckoutSession, UsageLedgerEntry } from "@/lib/app-state/types";
import {
  billingPeriodForTimestamp,
  nowIso,
} from "@/lib/app-state/utils";

export async function ensureUsageLedgerEntryForSession(session: CheckoutSession) {
  const existing = await getUsageLedgerEntryBySession(session.session_id);
  if (existing) {
    return existing;
  }

  const recognizedAt = session.registered_at || session.confirmed_at || nowIso();
  const entry: UsageLedgerEntry = {
    usage_entry_id: randomUUID(),
    tenant_id: session.tenant_id,
    calendar_connection_id: session.calendar_connection_id,
    session_id: session.session_id,
    cipherpay_invoice_id: session.cipherpay_invoice_id,
    event_api_id: session.event_api_id,
    gross_amount: session.amount,
    currency: session.currency,
    service_fee_bps: session.service_fee_bps_snapshot,
    service_fee_amount: session.service_fee_amount_snapshot,
    recognized_at: recognizedAt,
    billing_period: billingPeriodForTimestamp(recognizedAt),
    status: "billable",
  };

  return putUsageLedgerEntry(entry);
}

export async function getBillingReportRows(billingPeriod: string) {
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
    "calendar_connection_id",
    "calendar_display_name",
    "billing_period",
    "session_count",
    "gross_volume",
    "service_fee_due",
    "currency",
  ];

  const body = rows.map((row) =>
    [
      row.tenant_id,
      row.tenant_name,
      row.calendar_connection_id,
      row.calendar_display_name,
      row.billing_period,
      row.session_count,
      row.gross_volume.toFixed(2),
      row.service_fee_due.toFixed(2),
      row.currency,
    ]
      .map(csvEscape)
      .join(","),
  );

  return [header.join(","), ...body].join("\n");
}
