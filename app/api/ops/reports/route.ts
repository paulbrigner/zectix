import { ensureOpsApiAccess } from "@/lib/admin-auth-server";
import { getBillingReportRows, renderBillingReportCsv } from "@/lib/billing/usage-ledger";
import { billingPeriodForTimestamp, nowIso } from "@/lib/app-state/utils";
import { jsonOk } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const unauthorized = await ensureOpsApiAccess();
  if (unauthorized) {
    return unauthorized;
  }

  const url = new URL(request.url);
  const billingPeriod =
    url.searchParams.get("billing_period") || billingPeriodForTimestamp(nowIso());
  const rows = await getBillingReportRows(billingPeriod);

  if (url.searchParams.get("format") === "csv") {
    return new Response(renderBillingReportCsv(rows), {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="billing-${billingPeriod}.csv"`,
      },
    });
  }

  return jsonOk({
    billing_period: billingPeriod,
    rows,
  });
}
