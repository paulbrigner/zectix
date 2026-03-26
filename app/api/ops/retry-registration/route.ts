import { retryDueRegistrations, retryRegistrationForSession } from "@/lib/app-state/service";
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
  const sessionId =
    body && typeof body === "object" && typeof body.session_id === "string"
      ? body.session_id.trim()
      : "";

  if (sessionId) {
    const task = await retryRegistrationForSession(sessionId);
    return jsonOk({
      mode: "single-session",
      session_id: sessionId,
      task,
    });
  }

  const tasks = await retryDueRegistrations(
    body && typeof body === "object" && typeof body.limit === "number"
      ? body.limit
      : 20,
  );
  return jsonOk({
    mode: "due-sessions",
    processed: tasks.length,
    tasks,
  });
}
