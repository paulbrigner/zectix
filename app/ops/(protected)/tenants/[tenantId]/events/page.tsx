import Link from "next/link";
import { notFound } from "next/navigation";
import {
  setTicketAssertionsAction,
  syncCalendarEventAction,
  validateAndSyncCalendarAction,
} from "@/app/ops/actions";
import { LocalDateTime } from "@/components/LocalDateTime";
import { ConsoleSwitch } from "@/components/ConsoleSwitch";
import type { TicketMirror } from "@/lib/app-state/types";
import { getTenantOpsDetail } from "@/lib/tenancy/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SearchParamValue = string | string[] | undefined;
type PillTone = "success" | "warning" | "danger" | "info" | "muted";
type SyncNotice = {
  error: string | null;
  eventId: string | null;
  eventName: string;
  focus: "mirrored" | "upstream";
  outcome:
    | "imported"
    | "updated"
    | "unchanged"
    | "hidden"
    | "canceled"
    | "missing"
    | null;
  syncStatus: string | null;
  ticketsAdded: number;
  ticketsRemoved: number;
  mirroredTicketCount: number;
  enabledTicketCount: number;
  publicCheckoutEnabled: boolean;
  syncedAt: string | null;
};

function isFutureEvent(startAt: string) {
  const startAtMs = new Date(startAt).getTime();
  return Number.isFinite(startAtMs) && startAtMs >= Date.now();
}

function readSearchValue(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

function readIntSearchValue(value: SearchParamValue) {
  const parsed = Number(readSearchValue(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function readSyncNotice(
  searchParams: Record<string, SearchParamValue>,
): SyncNotice | null {
  const error = readSearchValue(searchParams.sync_error) || null;
  const eventId = readSearchValue(searchParams.sync_event_id) || null;
  const eventName =
    readSearchValue(searchParams.sync_event_name) || "Selected event";
  if (!error && !eventId) {
    return null;
  }

  const outcome = readSearchValue(searchParams.sync_outcome);
  return {
    error,
    eventId,
    eventName,
    focus:
      readSearchValue(searchParams.sync_focus) === "upstream"
        ? "upstream"
        : "mirrored",
    outcome:
      outcome === "imported" ||
      outcome === "updated" ||
      outcome === "unchanged" ||
      outcome === "hidden" ||
      outcome === "canceled" ||
      outcome === "missing"
        ? outcome
        : null,
    syncStatus: readSearchValue(searchParams.sync_status) || null,
    ticketsAdded: readIntSearchValue(searchParams.sync_added),
    ticketsRemoved: readIntSearchValue(searchParams.sync_removed),
    mirroredTicketCount: readIntSearchValue(searchParams.sync_mirrored),
    enabledTicketCount: readIntSearchValue(searchParams.sync_enabled),
    publicCheckoutEnabled: readSearchValue(searchParams.sync_public) === "1",
    syncedAt: readSearchValue(searchParams.sync_at) || null,
  };
}

function pillClassName(tone: PillTone) {
  return `console-mini-pill console-mini-pill-${tone}`;
}

function syncStatusTone(syncStatus: string | null): PillTone {
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

function focusLabel(focus: "mirrored" | "upstream") {
  return focus === "upstream" ? "Upstream import path" : "Mirrored event";
}

function syncNoticeTitle(notice: SyncNotice) {
  if (notice.error) {
    return `Could not refresh ${notice.eventName}`;
  }

  switch (notice.outcome) {
    case "imported":
      return `${notice.eventName} was imported into mirrored inventory`;
    case "updated":
      return `${notice.eventName} was refreshed from Luma`;
    case "hidden":
      return `${notice.eventName} no longer appears in the current Luma feed`;
    case "canceled":
      return `${notice.eventName} is marked canceled`;
    case "missing":
      return `${notice.eventName} could not be mirrored`;
    case "unchanged":
    default:
      return `No mirrored changes were needed for ${notice.eventName}`;
  }
}

function syncNoticeCopy(notice: SyncNotice) {
  if (notice.error) {
    return notice.error;
  }

  switch (notice.outcome) {
    case "imported":
      return "The backend still refreshed the full calendar, but this result is focused on the selected event and its mirrored ticket tiers.";
    case "updated":
      return "This event-focused summary captures how the mirrored record changed after the latest full-calendar refresh.";
    case "hidden":
      return "The selected event is no longer visible in the latest Luma feed, so its mirrored inventory has been hidden from public checkout.";
    case "canceled":
      return "The selected event is still mirrored, but it is now marked canceled in the latest sync result.";
    case "missing":
      return "The selected event was not available for mirroring after the refresh. Check the upstream Luma feed and try again if needed.";
    case "unchanged":
    default:
      return "The full-calendar refresh completed, but this selected event did not require any mirrored event or ticket changes.";
  }
}

function ticketReviewTone(ticket: TicketMirror): PillTone {
  if (!ticket.public_checkout_requested) {
    return "muted";
  }

  if (ticket.zcash_enabled) {
    return "success";
  }
  if (ticket.automatic_eligibility_reasons.length) {
    return "warning";
  }
  return "muted";
}

function ticketReviewLabel(ticket: TicketMirror) {
  if (!ticket.public_checkout_requested) {
    return "Hidden by choice";
  }

  if (ticket.zcash_enabled) {
    return "Ready for checkout";
  }
  if (ticket.automatic_eligibility_reasons.length) {
    return "Needs attention";
  }
  return "Needs confirmation";
}

function ticketReviewCopy(ticket: TicketMirror) {
  if (!ticket.public_checkout_requested) {
    return "This ticket is intentionally hidden from public checkout.";
  }

  if (ticket.automatic_eligibility_reasons.length) {
    return `Automatic review: ${ticket.automatic_eligibility_reasons.join(" · ")}`;
  }
  if (ticket.zcash_enabled) {
    return "This ticket is already available for public checkout.";
  }
  return "Automatic review passed. Confirm the organizer-side requirements below to enable checkout.";
}

function mirroredEventBadges(event: {
  sync_status: string;
  zcash_enabled: boolean;
}) {
  return [
    { label: "Mirrored", tone: "info" as const },
    {
      label: syncStatusLabel(event.sync_status),
      tone: syncStatusTone(event.sync_status),
    },
    {
      label: event.zcash_enabled
        ? "Public checkout enabled"
        : "Public checkout hidden",
      tone: event.zcash_enabled ? ("success" as const) : ("muted" as const),
    },
  ];
}

function upstreamEventBadges() {
  return [
    { label: "Upstream only", tone: "warning" as const },
    { label: "Not mirrored yet", tone: "muted" as const },
    { label: "Event-focused import path", tone: "info" as const },
  ];
}

export default async function TenantEventsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<Record<string, SearchParamValue>>;
}) {
  const { tenantId } = await params;
  const resolvedSearchParams = await searchParams;
  const detail = await getTenantOpsDetail(tenantId);
  if (!detail) {
    notFound();
  }

  const syncNotice = readSyncNotice(resolvedSearchParams);
  const eventsByCalendarId = new Map(
    detail.events.map(
      ({ calendar, events }) =>
        [calendar.calendar_connection_id, events] as const,
    ),
  );

  const eventGroups = detail.calendars
    .map((calendar) => {
      const events = (
        eventsByCalendarId.get(calendar.calendar_connection_id) || []
      ).filter((event) => isFutureEvent(event.start_at));
      const mirroredEventIds = new Set(
        events.map((event) => event.event_api_id),
      );
      const upstreamPreview =
        detail.upstream_luma_events_by_calendar.get(
          calendar.calendar_connection_id,
        ) || null;
      const upstreamEvents =
        upstreamPreview?.events.filter(
          (event) =>
            isFutureEvent(event.start_at) &&
            !mirroredEventIds.has(event.api_id),
        ) || [];

      return {
        calendar,
        events,
        upstreamEvents,
        upstreamError: upstreamPreview?.error || null,
      };
    })
    .filter(
      ({ events, upstreamEvents, upstreamError }) =>
        events.length > 0 ||
        upstreamEvents.length > 0 ||
        Boolean(upstreamError),
    );

  return (
    <section className="console-section">
      <div className="console-section-header">
        <div>
          <h2>Organization events</h2>
          <p className="subtle-text">
            Use event-focused sync actions to review one event at a time without
            changing the backend&apos;s full-calendar mirror model. Imported
            events still land behind the existing automatic and operator
            ticket-eligibility controls before public checkout exposure.
          </p>
        </div>
      </div>

      {syncNotice ? (
        <div
          className={`console-detail-card console-sync-feedback${syncNotice.error ? " console-sync-feedback-error" : ""}`}
        >
          <div className="console-section-header">
            <div>
              <p className="console-kpi-label">
                {focusLabel(syncNotice.focus)}
              </p>
              <h3>{syncNoticeTitle(syncNotice)}</h3>
              <p className="subtle-text">{syncNoticeCopy(syncNotice)}</p>
            </div>
            <div className="console-mini-pill-row">
              <span
                className={pillClassName(
                  syncNotice.focus === "upstream" ? "warning" : "info",
                )}
              >
                {focusLabel(syncNotice.focus)}
              </span>
              {syncNotice.syncStatus ? (
                <span
                  className={pillClassName(
                    syncStatusTone(syncNotice.syncStatus),
                  )}
                >
                  {syncStatusLabel(syncNotice.syncStatus)}
                </span>
              ) : null}
              <span
                className={pillClassName(
                  syncNotice.publicCheckoutEnabled ? "success" : "muted",
                )}
              >
                {syncNotice.publicCheckoutEnabled
                  ? "Public checkout enabled"
                  : "Public checkout hidden"}
              </span>
            </div>
          </div>

          {!syncNotice.error ? (
            <div className="console-signal-grid">
              <div className="console-signal-card">
                <span className="console-kpi-label">Ticket tiers added</span>
                <strong>{syncNotice.ticketsAdded}</strong>
                <p className="subtle-text">
                  Active tiers newly mirrored after refresh
                </p>
              </div>
              <div className="console-signal-card">
                <span className="console-kpi-label">Ticket tiers removed</span>
                <strong>{syncNotice.ticketsRemoved}</strong>
                <p className="subtle-text">
                  Previously active tiers no longer in the current feed
                </p>
              </div>
              <div className="console-signal-card">
                <span className="console-kpi-label">Mirrored tiers now</span>
                <strong>{syncNotice.mirroredTicketCount}</strong>
                <p className="subtle-text">
                  {syncNotice.enabledTicketCount} currently eligible for public
                  checkout
                </p>
              </div>
              <div className="console-signal-card">
                <span className="console-kpi-label">Synced at</span>
                <strong>
                  {syncNotice.syncedAt ? (
                    <LocalDateTime iso={syncNotice.syncedAt} />
                  ) : (
                    "n/a"
                  )}
                </strong>
                <p className="subtle-text">
                  Full-calendar refresh, event-focused summary
                </p>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {eventGroups.length === 0 ? (
        <div className="console-detail-card">
          <h3>No future events</h3>
          <p className="subtle-text">
            Event-focused sync and ticket assertions only appear for events
            whose start time is still in the future.
          </p>
        </div>
      ) : null}

      {eventGroups.map(
        ({ calendar, events, upstreamEvents, upstreamError }) => (
          <section
            className="console-content"
            key={calendar.calendar_connection_id}
          >
            <div className="console-section-header">
              <div>
                <h3>{calendar.display_name}</h3>
                <p className="subtle-text">
                  Use the per-event controls below for targeted review. The
                  backend still runs the existing full-calendar refresh, but
                  each result is summarized as an event-focused diff.
                </p>
              </div>
              <form action={validateAndSyncCalendarAction}>
                <input
                  name="calendar_connection_id"
                  type="hidden"
                  value={calendar.calendar_connection_id}
                />
                <input
                  name="redirect_to"
                  type="hidden"
                  value={`/ops/tenants/${tenantId}/events`}
                />
                <button
                  className="button button-secondary button-small"
                  type="submit"
                >
                  Refresh whole calendar
                </button>
              </form>
            </div>

            {upstreamError ? (
              <div className="console-preview-empty">
                <strong>Could not load the current upstream Luma feed</strong>
                <p className="subtle-text">{upstreamError}</p>
              </div>
            ) : null}

            {upstreamEvents.length ? (
              <div className="console-detail-card">
                <div className="console-section-header">
                  <div>
                    <h4>Available from Luma but not yet mirrored</h4>
                    <p className="subtle-text">
                      Use the event-focused sync control here to import one
                      selected event into mirrored inventory without relying on
                      the whole-calendar action as the primary operator
                      workflow.
                    </p>
                  </div>
                </div>

                <div className="console-preview-list">
                  {upstreamEvents.map((event) => (
                    <article
                      className="console-preview-card"
                      key={event.api_id}
                    >
                      {event.cover_url ? (
                        <div className="console-preview-media">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img alt={event.name} src={event.cover_url} />
                        </div>
                      ) : (
                        <div className="console-preview-media console-preview-media-fallback">
                          <span>{event.name.slice(0, 2).toUpperCase()}</span>
                        </div>
                      )}
                      <div className="console-preview-body">
                        <div className="console-preview-body-head">
                          <div>
                            <p className="console-kpi-label">
                              {calendar.display_name}
                            </p>
                            <h4>{event.name}</h4>
                          </div>
                          <div className="console-mini-pill-row">
                            {upstreamEventBadges().map((badge) => (
                              <span
                                className={pillClassName(badge.tone)}
                                key={badge.label}
                              >
                                {badge.label}
                              </span>
                            ))}
                          </div>
                        </div>
                        <p className="subtle-text">
                          <LocalDateTime iso={event.start_at} />
                          {event.location_label
                            ? ` · ${event.location_label}`
                            : ""}
                        </p>
                        <p className="subtle-text">
                          Syncing this event still refreshes the current
                          calendar connection in the backend, but the operator
                          feedback is scoped to this event only.
                        </p>
                        <div className="button-row">
                          <form action={syncCalendarEventAction}>
                            <input
                              name="tenant_id"
                              type="hidden"
                              value={tenantId}
                            />
                            <input
                              name="calendar_connection_id"
                              type="hidden"
                              value={calendar.calendar_connection_id}
                            />
                            <input
                              name="event_api_id"
                              type="hidden"
                              value={event.api_id}
                            />
                            <input
                              name="event_name"
                              type="hidden"
                              value={event.name}
                            />
                            <input
                              name="focus"
                              type="hidden"
                              value="upstream"
                            />
                            <input
                              name="redirect_to"
                              type="hidden"
                              value={`/ops/tenants/${tenantId}/events`}
                            />
                            <button
                              className="button button-small"
                              type="submit"
                            >
                              Sync this event
                            </button>
                          </form>
                          {event.url ? (
                            <a
                              className="button button-secondary button-small"
                              href={event.url}
                              rel="noreferrer noopener"
                              target="_blank"
                            >
                              Open on Luma
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}

            {events.map((event) => {
              const mirroredTickets =
                detail.tickets_by_event.get(event.event_api_id) || [];
              const enabledTickets = mirroredTickets.filter(
                (ticket) => ticket.zcash_enabled,
              );
              const publicEventHref =
                event.sync_status === "active" && event.zcash_enabled
                  ? `/c/${calendar.slug}/events/${encodeURIComponent(event.event_api_id)}`
                  : null;

              return (
                <article
                  className="console-detail-card console-event-review-card"
                  key={event.event_api_id}
                >
                  <div className="console-event-review-head">
                    {event.cover_url ? (
                      <div className="console-preview-media console-preview-media-square">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img alt={event.name} src={event.cover_url} />
                      </div>
                    ) : (
                      <div className="console-preview-media console-preview-media-fallback console-preview-media-square">
                        <span>{event.name.slice(0, 2).toUpperCase()}</span>
                      </div>
                    )}
                    <div className="console-event-review-copy">
                      <div className="console-preview-body-head">
                        <div>
                          <p className="console-kpi-label">
                            {calendar.display_name}
                          </p>
                          <h3>{event.name}</h3>
                        </div>
                        <div className="console-mini-pill-row">
                          {mirroredEventBadges(event).map((badge) => (
                            <span
                              className={pillClassName(badge.tone)}
                              key={badge.label}
                            >
                              {badge.label}
                            </span>
                          ))}
                        </div>
                      </div>
                      <p className="subtle-text">
                        <LocalDateTime iso={event.start_at} />
                        {event.location_label
                          ? ` · ${event.location_label}`
                          : ""}
                      </p>
                      <p className="subtle-text">
                        {event.zcash_enabled_reason || "No reason recorded"}
                      </p>
                      <div className="button-row">
                        <form action={syncCalendarEventAction}>
                          <input
                            name="tenant_id"
                            type="hidden"
                            value={tenantId}
                          />
                          <input
                            name="calendar_connection_id"
                            type="hidden"
                            value={calendar.calendar_connection_id}
                          />
                          <input
                            name="event_api_id"
                            type="hidden"
                            value={event.event_api_id}
                          />
                          <input
                            name="event_name"
                            type="hidden"
                            value={event.name}
                          />
                          <input name="focus" type="hidden" value="mirrored" />
                          <input
                            name="redirect_to"
                            type="hidden"
                            value={`/ops/tenants/${tenantId}/events`}
                          />
                          <button className="button button-small" type="submit">
                            Sync this event
                          </button>
                        </form>
                        {event.url ? (
                          <a
                            className="button button-secondary button-small"
                            href={event.url}
                            rel="noreferrer noopener"
                            target="_blank"
                          >
                            Open on Luma
                          </a>
                        ) : null}
                        {publicEventHref ? (
                          <Link
                            className="button button-secondary button-small"
                            href={publicEventHref}
                          >
                            Open public event
                          </Link>
                        ) : (
                          <button
                            className="button button-secondary button-small"
                            disabled
                            type="button"
                          >
                            Public event hidden
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="console-signal-grid">
                    <div className="console-signal-card">
                      <span className="console-kpi-label">Mirror state</span>
                      <strong>{syncStatusLabel(event.sync_status)}</strong>
                      <p className="subtle-text">
                        {event.sync_status === "active"
                          ? "Mirrored and available for ticket assertions."
                          : event.sync_status === "hidden"
                            ? "No longer visible in the current Luma feed."
                            : event.sync_status === "canceled"
                              ? "Marked canceled in the mirrored state."
                              : "Needs operator review after the latest sync."}
                      </p>
                    </div>
                    <div className="console-signal-card">
                      <span className="console-kpi-label">Ticket tiers</span>
                      <strong>{mirroredTickets.length} mirrored</strong>
                      <p className="subtle-text">
                        {enabledTickets.length} enabled for public checkout
                      </p>
                    </div>
                    <div className="console-signal-card">
                      <span className="console-kpi-label">Last sync</span>
                      <strong>
                        {event.last_synced_at ? "Updated" : "Pending"}
                      </strong>
                      <p className="subtle-text">
                        {event.last_synced_at ? (
                          <LocalDateTime iso={event.last_synced_at} />
                        ) : (
                          "This event has not been refreshed yet."
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="console-card-grid console-ticket-assertion-grid">
                    {mirroredTickets.map((ticket) => (
                      <form
                        action={setTicketAssertionsAction}
                        className="console-detail-card console-ticket-review-card tenant-ticket-review-form"
                        key={ticket.ticket_type_api_id}
                      >
                        <input
                          name="event_api_id"
                          type="hidden"
                          value={ticket.event_api_id}
                        />
                        <input
                          name="ticket_type_api_id"
                          type="hidden"
                          value={ticket.ticket_type_api_id}
                        />
                        <input
                          name="redirect_to"
                          type="hidden"
                          value={`/ops/tenants/${tenantId}/events`}
                        />
                        <input
                          name="public_checkout_requested_present"
                          type="hidden"
                          value="1"
                        />
                        <div className="console-ticket-review-head">
                          <div className="console-ticket-review-topline">
                            <div className="console-table-cell-stack">
                              <p className="console-kpi-label">
                                {ticket.active
                                  ? "Active in Luma"
                                  : "Inactive in Luma"}
                              </p>
                              <strong className="console-ticket-review-title">
                                {ticket.name}
                              </strong>
                            </div>
                            <strong className="console-ticket-review-price">
                              {ticketSummaryLabel(ticket)}
                            </strong>
                          </div>

                          <div className="console-mini-pill-row console-ticket-review-pills">
                            <span
                              className={pillClassName(
                                ticketReviewTone(ticket),
                              )}
                            >
                              {ticketReviewLabel(ticket)}
                            </span>
                          </div>

                          <div className="console-ticket-review-summary">
                            <p className="subtle-text">
                              {ticketReviewCopy(ticket)}
                            </p>
                          </div>
                        </div>

                        <div className="tenant-ticket-review-checks">
                          <ConsoleSwitch
                            className="tenant-ticket-review-check"
                            defaultChecked={ticket.public_checkout_requested}
                            description="Turn this off to keep the ticket hidden from public checkout."
                            label="Allow this ticket on public checkout"
                            name="public_checkout_requested"
                          />
                        </div>

                        <div className="console-ticket-review-actions">
                          <button
                            className="button button-secondary button-small"
                            type="submit"
                          >
                            Save ticket settings
                          </button>
                        </div>
                      </form>
                    ))}
                  </div>
                </article>
              );
            })}
          </section>
        ),
      )}
    </section>
  );
}

function ticketSummaryLabel(ticket: {
  amount: number | null;
  currency: string | null;
}) {
  if (ticket.amount == null || !ticket.currency) {
    return "Price from Luma";
  }

  return `${ticket.currency.toUpperCase()} ${ticket.amount.toFixed(2)}`;
}
