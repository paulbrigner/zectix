import { retryDueRegistrations } from "@/lib/app-state/service";
import { jsonError, jsonOk } from "@/lib/http";
import { isValidOpsAutomationSecret } from "@/lib/ops-automation";

export const runtime = "nodejs";

function readAutomationSecret(request: Request) {
  return (
    request.headers.get("x-ops-automation-secret") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    null
  );
}

export async function POST(request: Request) {
  if (!isValidOpsAutomationSecret(readAutomationSecret(request))) {
    return jsonError("Unauthorized", 401);
  }

  const body = await request.json().catch(() => null);
  const limit =
    body && typeof body === "object" && typeof body.limit === "number"
      ? body.limit
      : 20;
  const tasks = await retryDueRegistrations(limit);
  return jsonOk({
    processed: tasks.length,
    tasks,
  });
}
