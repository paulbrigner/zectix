import { createCheckoutSession } from "@/lib/test-harness/service";
import { jsonError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const attendeeEmail =
    body && typeof body === "object" && typeof body.attendee_email === "string"
      ? body.attendee_email.trim()
      : "";
  const attendeeName =
    body && typeof body === "object" && typeof body.attendee_name === "string"
      ? body.attendee_name.trim()
      : "";
  const eventApiId =
    body && typeof body === "object" && typeof body.event_api_id === "string"
      ? body.event_api_id.trim()
      : "";
  const ticketTypeApiId =
    body &&
    typeof body === "object" &&
    typeof body.ticket_type_api_id === "string" &&
    body.ticket_type_api_id.trim().length > 0
      ? body.ticket_type_api_id.trim()
      : null;

  if (!eventApiId || !attendeeName || !attendeeEmail) {
    return jsonError("Event, attendee name, and attendee email are required.");
  }

  try {
    const result = await createCheckoutSession({
      attendee_email: attendeeEmail,
      attendee_name: attendeeName,
      event_api_id: eventApiId,
      ticket_type_api_id: ticketTypeApiId,
    });

    return jsonOk(result);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to create checkout session",
      500,
    );
  }
}

