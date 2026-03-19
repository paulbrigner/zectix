import { createCheckoutSession } from "@/lib/app-state/service";
import { consumeCheckoutRateLimit } from "@/lib/app-state/state";
import { jsonError, jsonOk } from "@/lib/http";
import { createSessionViewerToken } from "@/lib/session-viewer";

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

  const forwardedFor = request.headers.get("x-forwarded-for");
  const ipAddress = forwardedFor?.split(",")[0]?.trim() || null;

  const rateLimit = await consumeCheckoutRateLimit({
    ipAddress,
    attendeeEmail,
    eventApiId,
  });
  if (!rateLimit.ok) {
    return jsonError(rateLimit.reason || "Too many checkout attempts.", 429, {
      headers: {
        "retry-after": String(rateLimit.retry_after_seconds || 600),
      },
    });
  }

  try {
    const result = await createCheckoutSession({
      attendee_email: attendeeEmail,
      attendee_name: attendeeName,
      event_api_id: eventApiId,
      ticket_type_api_id: ticketTypeApiId,
    });

    return jsonOk({
      ...result,
      viewer_token: createSessionViewerToken(
        result.session.session_id,
        result.session.attendee_email,
      ),
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to create checkout session",
      500,
    );
  }
}
