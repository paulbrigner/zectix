import type {
  CalendarConnection,
  CheckoutSession,
  EventMirror,
  TicketMirror,
} from "@/lib/app-state/types";
import { selectUpcomingEvents } from "@/lib/embed";
import type { LumaEvent } from "@/lib/luma";
import type { TenantOpsDetail } from "@/lib/tenancy/service";

export type TenantOnboardingChecklistItem = {
  complete: boolean;
  description: string;
  label: string;
};

export type TenantEventWorkspaceFilter =
  | "all"
  | "needs_attention"
  | "live"
  | "hidden"
  | "import_candidates";

export type TenantEventWorkspaceTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "muted";

export type TenantEventWorkspaceRow = {
  calendar: CalendarConnection;
  cover_url: string | null;
  enabled_ticket_count: number;
  event_id: string;
  event_name: string;
  event_url: string | null;
  last_synced_at: string | null;
  location_label: string | null;
  mirrored_event: EventMirror | null;
  needs_attention_count: number;
  primary_blocker: string;
  public_status_label: string;
  public_status_tone: TenantEventWorkspaceTone;
  row_id: string;
  source: "mirrored" | "upstream";
  start_at: string;
  sync_status: string | null;
  sync_status_label: string;
  sync_status_tone: TenantEventWorkspaceTone;
  ticket_count: number;
  tickets: TicketMirror[];
  upstream_event: LumaEvent | null;
};

function buildEventWorkspaceRowId(
  source: "mirrored" | "upstream",
  calendarConnectionId: string,
  eventId: string,
) {
  return `${source}:${calendarConnectionId}:${eventId}`;
}

function syncStatusTone(syncStatus: string | null): TenantEventWorkspaceTone {
  switch (syncStatus) {
    case "active":
      return "success";
    case "canceled":
      return "warning";
    case "error":
      return "danger";
    case "hidden":
      return "muted";
    default:
      return "info";
  }
}

function syncStatusLabel(syncStatus: string | null) {
  switch (syncStatus) {
    case "active":
      return "Sync active";
    case "canceled":
      return "Event canceled";
    case "error":
      return "Sync failed";
    case "hidden":
      return "No longer in Luma";
    default:
      return "Needs sync";
  }
}

function primaryBlockerForMirroredEvent(
  event: EventMirror,
  tickets: TicketMirror[],
  enabledTicketCount: number,
  needsAttentionCount: number,
) {
  if (event.sync_status === "error") {
    return "Sync failed";
  }

  if (event.sync_status === "canceled") {
    return "Event canceled in Luma";
  }

  if (!tickets.length) {
    return "No ticket tiers mirrored";
  }

  if (needsAttentionCount > 0) {
    return `${needsAttentionCount} ticket${needsAttentionCount === 1 ? "" : "s"} need review`;
  }

  if (!enabledTicketCount) {
    return event.zcash_enabled_reason || "Enable at least one ticket";
  }

  if (!event.zcash_enabled) {
    return event.zcash_enabled_reason || "Public checkout hidden";
  }

  return "Live";
}

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
      count + current.tickets.filter(ticketNeedsAttention).length
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

  return (
    !ticket.confirmed_fixed_price ||
    !ticket.confirmed_no_approval_required ||
    !ticket.confirmed_no_extra_required_questions
  );
}

export function upcomingEnabledEvents(events: EventMirror[]) {
  return selectUpcomingEvents(events.filter((event) => event.zcash_enabled));
}

export function buildTenantEventWorkspaceRows(
  detail: TenantOpsDetail,
  nowMs = Date.now(),
): TenantEventWorkspaceRow[] {
  const rows = detail.calendars.flatMap((calendar) => {
    const mirroredEvents = (detail.events.find(
      (entry) => entry.calendar.calendar_connection_id === calendar.calendar_connection_id,
    )?.events || [])
      .filter((event) => isFutureEvent(event.start_at, nowMs))
      .sort((left, right) => new Date(left.start_at).getTime() - new Date(right.start_at).getTime());
    const mirroredIds = new Set(mirroredEvents.map((event) => event.event_api_id));
    const upstreamPreview =
      detail.upstream_luma_events_by_calendar.get(calendar.calendar_connection_id) || null;
    const upstreamEvents = (upstreamPreview?.events || [])
      .filter(
        (event) => isFutureEvent(event.start_at, nowMs) && !mirroredIds.has(event.api_id),
      )
      .sort((left, right) => new Date(left.start_at).getTime() - new Date(right.start_at).getTime());

    const mirroredRows: TenantEventWorkspaceRow[] = mirroredEvents.map((event) => {
      const tickets = detail.tickets_by_event.get(event.event_api_id) || [];
      const enabledTicketCount = tickets.filter((ticket) => ticket.zcash_enabled).length;
      const needsAttentionCount = tickets.filter(ticketNeedsAttention).length;
      const publicStatusLabel = event.zcash_enabled ? "Live" : "Hidden";
      const publicStatusTone: TenantEventWorkspaceTone = event.zcash_enabled
        ? "success"
        : "muted";
      return {
        calendar,
        cover_url: event.cover_url,
        enabled_ticket_count: enabledTicketCount,
        event_id: event.event_api_id,
        event_name: event.name,
        event_url: event.url,
        last_synced_at: event.last_synced_at,
        location_label: event.location_label,
        mirrored_event: event,
        needs_attention_count: needsAttentionCount,
        primary_blocker: primaryBlockerForMirroredEvent(
          event,
          tickets,
          enabledTicketCount,
          needsAttentionCount,
        ),
        public_status_label: publicStatusLabel,
        public_status_tone: publicStatusTone,
        row_id: buildEventWorkspaceRowId(
          "mirrored",
          calendar.calendar_connection_id,
          event.event_api_id,
        ),
        source: "mirrored" as const,
        start_at: event.start_at,
        sync_status: event.sync_status,
        sync_status_label: syncStatusLabel(event.sync_status),
        sync_status_tone: syncStatusTone(event.sync_status),
        ticket_count: tickets.length,
        tickets,
        upstream_event: null,
      };
    });

    const upstreamRows: TenantEventWorkspaceRow[] = upstreamEvents.map((event) => ({
      calendar,
      cover_url: event.cover_url,
      enabled_ticket_count: 0,
      event_id: event.api_id,
      event_name: event.name,
      event_url: event.url,
      last_synced_at: null,
      location_label: event.location_label,
      mirrored_event: null,
      needs_attention_count: 0,
      primary_blocker: "Import to begin ticket review",
      public_status_label: "Import candidate",
      public_status_tone: "warning" as const,
      row_id: buildEventWorkspaceRowId(
        "upstream",
        calendar.calendar_connection_id,
        event.api_id,
      ),
      source: "upstream" as const,
      start_at: event.start_at,
      sync_status: null,
      sync_status_label: "Upstream only",
      sync_status_tone: "warning" as const,
      ticket_count: 0,
      tickets: [] as TicketMirror[],
      upstream_event: event,
    }));

    return [...mirroredRows, ...upstreamRows];
  });

  rows.sort((left, right) => {
    const startDiff =
      new Date(left.start_at).getTime() - new Date(right.start_at).getTime();
    if (startDiff !== 0) {
      return startDiff;
    }

    if (left.source !== right.source) {
      return left.source === "mirrored" ? -1 : 1;
    }

    return left.event_name.localeCompare(right.event_name);
  });

  return rows;
}

export function matchesTenantEventWorkspaceFilter(
  row: TenantEventWorkspaceRow,
  filter: TenantEventWorkspaceFilter,
) {
  switch (filter) {
    case "needs_attention":
      return (
        row.source === "upstream" ||
        row.sync_status === "error" ||
        row.sync_status === "canceled" ||
        row.needs_attention_count > 0 ||
        row.public_status_label !== "Live"
      );
    case "live":
      return row.source === "mirrored" && row.public_status_label === "Live";
    case "hidden":
      return row.source === "mirrored" && row.public_status_label === "Hidden";
    case "import_candidates":
      return row.source === "upstream";
    case "all":
    default:
      return true;
  }
}
