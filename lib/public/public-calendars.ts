import {
  getCalendarConnectionBySlug,
  getEventMirror,
  getTenant,
  getTicketMirror,
  listEventMirrorsByCalendar,
  listTicketMirrorsByEvent,
} from "@/lib/app-state/state";
import type { EventMirror, PublicCalendar, PublicEventPageData, TicketMirror } from "@/lib/app-state/types";

function isFutureEvent(event: EventMirror) {
  return new Date(event.start_at).getTime() >= Date.now() - 60 * 60 * 1000;
}

function sortEventsChronologically(events: EventMirror[]) {
  return [...events].sort(
    (left, right) =>
      new Date(left.start_at).getTime() - new Date(right.start_at).getTime(),
  );
}

export async function getPublicCalendar(calendarSlug: string): Promise<PublicCalendar | null> {
  const calendar = await getCalendarConnectionBySlug(calendarSlug);
  if (!calendar || calendar.status !== "active") {
    return null;
  }

  const tenant = await getTenant(calendar.tenant_id);
  if (!tenant || tenant.status !== "active") {
    return null;
  }

  const events = sortEventsChronologically(
    (await listEventMirrorsByCalendar(calendar.calendar_connection_id)).filter(
      (event) =>
        event.sync_status === "active" &&
        event.zcash_enabled &&
        isFutureEvent(event),
    ),
  );

  return {
    tenant,
    calendar,
    events,
  };
}

export async function getPublicEventPageData(
  calendarSlug: string,
  eventApiId: string,
): Promise<PublicEventPageData | null> {
  const calendarData = await getPublicCalendar(calendarSlug);
  if (!calendarData) {
    return null;
  }

  const event = await getEventMirror(
    calendarData.calendar.calendar_connection_id,
    eventApiId,
  );
  if (!event || event.sync_status !== "active" || !event.zcash_enabled) {
    return null;
  }

  const mirroredTickets = await listTicketMirrorsByEvent(eventApiId);
  const tickets = mirroredTickets.filter((ticket) => ticket.active && ticket.zcash_enabled);
  if (tickets.length === 0) {
    return null;
  }

  return {
    tenant: calendarData.tenant,
    calendar: calendarData.calendar,
    event,
    tickets,
  };
}

export async function getPublicTicket(
  calendarSlug: string,
  eventApiId: string,
  ticketTypeApiId: string,
): Promise<TicketMirror | null> {
  const eventPageData = await getPublicEventPageData(calendarSlug, eventApiId);
  if (!eventPageData) {
    return null;
  }

  const ticket =
    eventPageData.tickets.find((entry) => entry.ticket_type_api_id === ticketTypeApiId) ||
    (await getTicketMirror(eventApiId, ticketTypeApiId));

  if (!ticket || !ticket.active || !ticket.zcash_enabled) {
    return null;
  }

  return ticket;
}
