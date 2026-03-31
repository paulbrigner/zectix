import { createCheckoutSession } from "@/lib/app-state/service";
import { consumeCheckoutRateLimit } from "@/lib/app-state/state";
import { jsonError, jsonOk } from "@/lib/http";
import { createRequestId, logEvent } from "@/lib/observability";
import { getPublicCalendar } from "@/lib/public/public-calendars";
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
  const calendarSlug =
    body && typeof body === "object" && typeof body.calendar_slug === "string"
      ? body.calendar_slug.trim()
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
      : "";

  if (!calendarSlug || !eventApiId || !ticketTypeApiId || !attendeeName || !attendeeEmail) {
    return jsonError(
      "Calendar, event, ticket, attendee name, and attendee email are required.",
    );
  }

  const calendar = await getPublicCalendar(calendarSlug);
  if (!calendar) {
    return jsonError("That public calendar could not be found.", 404);
  }

  const ipAddress = getTrustedIpAddress(request);
  const rateLimit = await consumeCheckoutRateLimit({
    ipAddress,
    attendeeEmail,
    tenantId: calendar.tenant.tenant_id,
    eventApiId,
  });
  if (!rateLimit.ok) {
    logEvent("warn", "checkout.rate_limited", {
      request_id: requestId,
      tenant_id: calendar.tenant.tenant_id,
      event_api_id: eventApiId,
      calendar_slug: calendarSlug,
      reason: rateLimit.reason || "Too many checkout attempts.",
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
      calendar_slug: calendarSlug,
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
    logEvent("error", "checkout.request.failed", {
      request_id: requestId,
      event_api_id: eventApiId,
      calendar_slug: calendarSlug,
      error: error instanceof Error ? error.message : "Failed to create checkout session",
    });
    return jsonError("Something went wrong. Please try again.", 500);
  }
}
