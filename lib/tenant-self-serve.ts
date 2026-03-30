import type {
  CalendarConnection,
  CheckoutSession,
  EventMirror,
  TicketMirror,
} from "@/lib/app-state/types";
import { selectUpcomingEvents } from "@/lib/embed";
import type { TenantOpsDetail } from "@/lib/tenancy/service";

export type TenantOnboardingChecklistItem = {
  complete: boolean;
  description: string;
  label: string;
};

export function humanizeOnboardingStatus(value: string) {
  return value.replaceAll("_", " ");
}

export function isFutureEvent(startAt: string, nowMs = Date.now()) {
  const startAtMs = new Date(startAt).getTime();
  return Number.isFinite(startAtMs) && startAtMs >= nowMs;
}

export function calendarConnectionHealthLabel(
  calendar: CalendarConnection,
  hasSavedKey: boolean,
) {
  if (calendar.status === "disabled") {
    return "Disabled";
  }

  if (!hasSavedKey) {
    return "Not configured";
  }

  if (calendar.last_validated_at) {
    return "Connected";
  }

  return "Needs validation";
}

export function summarizeCalendarInventory(
  detail: TenantOpsDetail,
  calendar: CalendarConnection,
) {
  const mirroredEvents =
    detail.events.find(
      (entry) => entry.calendar.calendar_connection_id === calendar.calendar_connection_id,
    )?.events || [];
  const mirroredByEventId = new Map(
    mirroredEvents.map((event) => [event.event_api_id, event] as const),
  );
  const futureMirroredEvents = selectUpcomingEvents(mirroredEvents);
  const tickets = mirroredEvents.flatMap(
    (event) => detail.tickets_by_event.get(event.event_api_id) || [],
  );

  return {
    enabledEvents: mirroredEvents.filter((event) => event.zcash_enabled),
    enabledTickets: tickets.filter((ticket) => ticket.zcash_enabled),
    futureMirroredEvents,
    mirroredByEventId,
    mirroredEvents,
    tickets,
  };
}

export function buildOnboardingChecklist(
  detail: TenantOpsDetail,
): TenantOnboardingChecklistItem[] {
  const hasCalendar = detail.calendars.length > 0;
  const hasValidatedCalendar = detail.calendars.some(
    (calendar) => calendar.status === "active" && Boolean(calendar.last_validated_at),
  );
  const hasCipherPayConnection = detail.cipherpay_connections.length > 0;
  const hasValidatedCipherPay = detail.cipherpay_connections.some(
    (connection) => connection.status === "active",
  );

  return [
    {
      label: "Draft organizer created",
      complete: true,
      description: `Status ${detail.tenant.status} · onboarding ${humanizeOnboardingStatus(detail.tenant.onboarding_status)}`,
    },
    {
      label: "Connect at least one Luma calendar",
      complete: hasCalendar,
      description: hasCalendar
        ? `${detail.calendars.length} calendar connection${detail.calendars.length === 1 ? "" : "s"} configured`
        : "Add a calendar connection to start mirroring inventory.",
    },
    {
      label: "Validate and sync Luma",
      complete: hasValidatedCalendar,
      description: hasValidatedCalendar
        ? "At least one calendar was validated and mirrored."
        : "Run Connect and sync once the Luma key is saved.",
    },
    {
      label: "Attach a CipherPay account",
      complete: hasCipherPayConnection,
      description: hasCipherPayConnection
        ? `${detail.cipherpay_connections.length} CipherPay configuration${detail.cipherpay_connections.length === 1 ? "" : "s"} saved`
        : "Save a CipherPay account for the calendar you want to use for checkout.",
    },
    {
      label: "Validate CipherPay",
      complete: hasValidatedCipherPay,
      description: hasValidatedCipherPay
        ? "At least one CipherPay configuration is marked active."
        : "Validate the current CipherPay connection after saving it.",
    },
    {
      label: "Activate the tenant for public checkout",
      complete: detail.tenant.status === "active",
      description:
        detail.tenant.status === "active"
          ? "Public calendar routes can resolve for active calendars."
          : "A draft tenant stays dark publicly until it is activated.",
    },
  ];
}

export function buildEmbedEventUrl(calendarSlug: string, eventApiId: string) {
  return (
    `/c/${encodeURIComponent(calendarSlug)}` +
    `/events/${encodeURIComponent(eventApiId)}?embed=1`
  );
}

export function buildEmbedSnippet(url: string, title: string, height: number) {
  const safeTitle = title.replaceAll('"', "&quot;");
  return `<iframe src="${url}" title="${safeTitle}" style="width:100%;height:${height}px;border:0;" loading="lazy"></iframe>`;
}

function usesCallbackTokenFallback(delivery: TenantOpsDetail["webhooks"][number]) {
  return (
    delivery.validation_error === "accepted_via_callback_token" &&
    delivery.apply_status !== "ignored"
  );
}

export function buildWorkspaceOverview(detail: TenantOpsDetail) {
  const upcomingEvents = detail.events
    .flatMap(({ calendar, events }) =>
      events
        .filter((event) => isFutureEvent(event.start_at))
        .map((event) => ({
          calendar,
          event,
          tickets: detail.tickets_by_event.get(event.event_api_id) || [],
        })),
    )
    .sort((left, right) => {
      return new Date(left.event.start_at).getTime() - new Date(right.event.start_at).getTime();
    });
  const trackedSessions = detail.sessions.length;
  const pendingSessions = detail.sessions.filter(
    (session) =>
      session.status === "draft" ||
      session.status === "pending" ||
      session.status === "detected" ||
      session.status === "underpaid",
  ).length;
  const registeredSessions = detail.sessions.filter(
    (session) => session.registration_status === "registered",
  ).length;
  const invalidWebhooks = detail.webhooks.filter(
    (delivery) => !delivery.signature_valid && !usesCallbackTokenFallback(delivery),
  ).length;
  const activeCalendars = detail.calendars.filter(
    (calendar) => calendar.status === "active",
  ).length;
  const liveEvents = upcomingEvents.filter(({ event }) => event.zcash_enabled);
  const ticketsNeedingReview = upcomingEvents.reduce((count, current) => {
    return (
      count +
      current.tickets.filter(
        (ticket) =>
          !ticket.zcash_enabled &&
          ticket.automatic_eligibility_status === "eligible" &&
          !ticket.confirmed_fixed_price,
      ).length
    );
  }, 0);
  const embedReadyCalendars = detail.calendars.filter(
    (calendar) => calendar.embed_enabled && calendar.embed_allowed_origins.length > 0,
  ).length;
  const onboardingChecklist = buildOnboardingChecklist(detail);
  const nextStep =
    onboardingChecklist.find((item) => !item.complete) ||
    onboardingChecklist[onboardingChecklist.length - 1] ||
    null;

  return {
    activeCalendars,
    embedReadyCalendars,
    invalidWebhooks,
    liveEvents,
    nextStep,
    onboardingChecklist,
    pendingSessions,
    registeredSessions,
    ticketsNeedingReview,
    trackedSessions,
    upcomingEvents,
  };
}

export function recentSessionsForDashboard(sessions: CheckoutSession[], limit = 8) {
  return sessions.slice(0, limit);
}

export function ticketNeedsAttention(ticket: TicketMirror) {
  if (ticket.zcash_enabled) {
    return false;
  }

  if (ticket.automatic_eligibility_reasons.length > 0) {
    return true;
  }

  return !ticket.confirmed_fixed_price;
}

export function upcomingEnabledEvents(events: EventMirror[]) {
  return selectUpcomingEvents(events.filter((event) => event.zcash_enabled));
}
