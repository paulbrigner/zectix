import { jsonError, jsonOk } from "@/lib/http";
import { processLumaTicketRegisteredWebhook } from "@/lib/test-harness/service";
import { asRecord, asString } from "@/lib/test-harness/utils";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!rawBody) {
    return jsonError("Invalid JSON body");
  }

  let payload: unknown = null;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    payload = null;
  }

  const requestBody = asRecord(payload);
  if (!requestBody) {
    return jsonError("Invalid JSON body");
  }

  const eventType =
    asString(requestBody.type) ||
    asString(requestBody.event_type) ||
    "ticket.registered";

  if (eventType !== "ticket.registered" && eventType !== "guest.registered") {
    return jsonOk({
      ignored: true,
      reason: `Unsupported Luma webhook event: ${eventType}`,
    });
  }

  try {
    const session = await processLumaTicketRegisteredWebhook({
      requestBody,
    });

    return jsonOk({
      received: true,
      event_type: eventType,
      matched_session_id: session?.session_id || null,
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to process Luma webhook",
      500,
    );
  }
}
