import { createCheckoutSession } from "@/lib/app-state/service";
import { consumeCheckoutRateLimit } from "@/lib/app-state/state";
import { jsonError, jsonOk } from "@/lib/http";
import { createRequestId, logEvent } from "@/lib/observability";
import { getTrustedIpAddress } from "@/lib/request-security";
import { createSessionViewerToken } from "@/lib/session-viewer";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = createRequestId();
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

  const ipAddress = getTrustedIpAddress(request);

  const rateLimit = await consumeCheckoutRateLimit({
    ipAddress,
    attendeeEmail,
    eventApiId,
  });
  if (!rateLimit.ok) {
    logEvent("warn", "checkout.rate_limited", {
      request_id: requestId,
      actor_ip: ipAddress,
      attendee_email: attendeeEmail,
      event_api_id: eventApiId,
    });
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

    logEvent("info", "checkout.request.succeeded", {
      request_id: requestId,
      session_id: result.session.session_id,
      invoice_id: result.session.cipherpay_invoice_id,
      attendee_email: attendeeEmail,
      event_api_id: eventApiId,
    });

    return jsonOk({
      ...result,
      viewer_token: createSessionViewerToken(
        result.session.session_id,
        result.session.attendee_email,
      ),
    });
  } catch (error) {
    logEvent("error", "checkout.request.failed", {
      request_id: requestId,
      actor_ip: ipAddress,
      attendee_email: attendeeEmail,
      event_api_id: eventApiId,
      error: error instanceof Error ? error.message : "Failed to create checkout session",
    });
    return jsonError(
      error instanceof Error ? error.message : "Failed to create checkout session",
      500,
    );
  }
}
