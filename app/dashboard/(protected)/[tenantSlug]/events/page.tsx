import Link from "next/link";
import { notFound } from "next/navigation";
import {
  setTicketAssertionsAction,
  syncCalendarEventAction,
  validateAndSyncCalendarAction,
} from "@/app/dashboard/actions";
import { ConsoleDisclosure } from "@/components/ConsoleDisclosure";
import { LocalDateTime } from "@/components/LocalDateTime";
import { requireTenantPageAccess } from "@/lib/tenant-auth-server";
import { getTenantSelfServeDetailBySlug } from "@/lib/tenancy/service";

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

function compareByStartAt<T extends { start_at: string }>(left: T, right: T) {
  return new Date(left.start_at).getTime() - new Date(right.start_at).getTime();
}

function readSearchValue(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

function readIntSearchValue(value: SearchParamValue) {
  const parsed = Number(readSearchValue(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function readSyncNotice(searchParams: Record<string, SearchParamValue>): SyncNotice | null {
  const error = readSearchValue(searchParams.sync_error) || null;
  const eventId = readSearchValue(searchParams.sync_event_id) || null;
  const eventName = readSearchValue(searchParams.sync_event_name) || "Selected event";
  if (!error && !eventId) {
    return null;
  }

  const outcome = readSearchValue(searchParams.sync_outcome);
  return {
    error,
    eventId,
    eventName,
    focus: readSearchValue(searchParams.sync_focus) === "upstream" ? "upstream" : "mirrored",
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
      return "The backend still refreshed the full calendar, but this summary is focused on the selected event and its ticket tiers.";
    case "updated":
      return "This event-focused summary shows how the mirrored record changed after the latest refresh.";
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
      label: event.zcash_enabled ? "Public checkout enabled" : "Public checkout hidden",
      tone: event.zcash_enabled ? ("success" as const) : ("muted" as const),
    },
  ];
}

function upstreamEventBadges() {
  return [
    { label: "Upstream only", tone: "warning" as const },
    { label: "Not mirrored yet", tone: "muted" as const },
    { label: "Ready to import", tone: "info" as const },
  ];
}

function countEnabledTickets(tickets: Array<{ zcash_enabled: boolean }>) {
  return tickets.filter((ticket) => ticket.zcash_enabled).length;
}

function ticketReviewTone(ticket: {
  automatic_eligibility_reasons: string[];
  zcash_enabled: boolean;
}) {
  if (ticket.zcash_enabled) {
    return "success" as const;
  }
  if (ticket.automatic_eligibility_reasons.length) {
    return "warning" as const;
  }
  return "muted" as const;
}

function ticketReviewLabel(ticket: {
  automatic_eligibility_reasons: string[];
  zcash_enabled: boolean;
}) {
  if (ticket.zcash_enabled) {
    return "Ready for checkout";
  }
  if (ticket.automatic_eligibility_reasons.length) {
    return "Needs attention";
  }
  return "Needs confirmation";
}

function ticketReviewCopy(ticket: {
  automatic_eligibility_reasons: string[];
  zcash_enabled: boolean;
}) {
  if (ticket.automatic_eligibility_reasons.length) {
    return `Automatic review: ${ticket.automatic_eligibility_reasons.join(" · ")}`;
  }
  if (ticket.zcash_enabled) {
    return "This ticket is already available for managed public checkout.";
  }
  return "Automatic review passed. Confirm the organizer-side requirements below to enable checkout.";
}

export default async function TenantEventsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<Record<string, SearchParamValue>>;
}) {
  const email = await requireTenantPageAccess();
  const { tenantSlug } = await params;
  const resolvedSearchParams = await searchParams;
  const detail = await getTenantSelfServeDetailBySlug(tenantSlug, email);
  if (!detail) {
    notFound();
  }

  const syncNotice = readSyncNotice(resolvedSearchParams);
  const eventsByCalendarId = new Map(
    detail.events.map(({ calendar, events }) => [calendar.calendar_connection_id, events] as const),
  );

  const eventGroups = detail.calendars
    .map((calendar) => {
      const events = (eventsByCalendarId.get(calendar.calendar_connection_id) || [])
        .filter((event) => isFutureEvent(event.start_at))
        .sort(compareByStartAt);
      const mirroredEventIds = new Set(events.map((event) => event.event_api_id));
      const upstreamPreview =
        detail.upstream_luma_events_by_calendar.get(calendar.calendar_connection_id) || null;
      const upstreamEvents = (upstreamPreview?.events || [])
        .filter((event) => isFutureEvent(event.start_at) && !mirroredEventIds.has(event.api_id))
        .sort(compareByStartAt);

      return {
        calendar,
        events,
        upstreamEvents,
        upstreamError: upstreamPreview?.error || null,
      };
    })
    .filter(
      ({ events, upstreamEvents, upstreamError }) =>
        events.length > 0 || upstreamEvents.length > 0 || Boolean(upstreamError),
    );
  const mirroredEventCount = eventGroups.reduce((count, group) => count + group.events.length, 0);
  const importCandidateCount = eventGroups.reduce(
    (count, group) => count + group.upstreamEvents.length,
    0,
  );
  const liveEventCount = eventGroups.reduce(
    (count, group) => count + group.events.filter((event) => event.zcash_enabled).length,
    0,
  );
  const ticketsNeedingReview = eventGroups.reduce((count, group) => {
    return (
      count +
      group.events.reduce((eventCount, event) => {
        const mirroredTickets = detail.tickets_by_event.get(event.event_api_id) || [];
        return (
          eventCount +
          mirroredTickets.filter(
            (ticket) =>
              !ticket.zcash_enabled &&
              (ticket.automatic_eligibility_reasons.length > 0 ||
                !ticket.confirmed_fixed_price ||
                !ticket.confirmed_no_approval_required ||
                !ticket.confirmed_no_extra_required_questions),
          ).length
        );
      }, 0)
    );
  }, 0);

  const basePath = `/dashboard/${encodeURIComponent(detail.tenant.slug)}`;

  return (
    <section className="console-section">
      <div className="console-section-header">
        <div>
          <h2>Events and tickets</h2>
          <p className="subtle-text">
            Scan what is live, what still needs review, and what is waiting to be imported from
            Luma.
          </p>
        </div>
      </div>

      <div className="console-kpi-grid">
        <article className="console-kpi-card">
          <p className="console-kpi-label">Mirrored events</p>
          <p className="console-kpi-value">{mirroredEventCount}</p>
          <p className="subtle-text console-kpi-detail">
            future event{mirroredEventCount === 1 ? "" : "s"} in this workspace
          </p>
        </article>
        <article className="console-kpi-card">
          <p className="console-kpi-label">Public checkout live</p>
          <p className="console-kpi-value">{liveEventCount}</p>
          <p className="subtle-text console-kpi-detail">
            event{liveEventCount === 1 ? "" : "s"} currently visible publicly
          </p>
        </article>
        <article className="console-kpi-card">
          <p className="console-kpi-label">Ticket review</p>
          <p className="console-kpi-value">{ticketsNeedingReview}</p>
          <p className="subtle-text console-kpi-detail">
            ticket{ticketsNeedingReview === 1 ? "" : "s"} still need organizer confirmation
          </p>
        </article>
        <article className="console-kpi-card">
          <p className="console-kpi-label">Import candidates</p>
          <p className="console-kpi-value">{importCandidateCount}</p>
          <p className="subtle-text console-kpi-detail">
            upcoming Luma event{importCandidateCount === 1 ? "" : "s"} not yet mirrored
          </p>
        </article>
      </div>

      {syncNotice ? (
        <div
          className={`console-detail-card console-sync-feedback${syncNotice.error ? " console-sync-feedback-error" : ""}`}
        >
          <div className="console-section-header">
            <div>
              <p className="console-kpi-label">{focusLabel(syncNotice.focus)}</p>
              <h3>{syncNoticeTitle(syncNotice)}</h3>
              <p className="subtle-text">{syncNoticeCopy(syncNotice)}</p>
            </div>
            <div className="console-mini-pill-row">
              <span className={pillClassName(syncNotice.focus === "upstream" ? "warning" : "info")}>
                {focusLabel(syncNotice.focus)}
              </span>
              {syncNotice.syncStatus ? (
                <span className={pillClassName(syncStatusTone(syncNotice.syncStatus))}>
                  {syncStatusLabel(syncNotice.syncStatus)}
                </span>
              ) : null}
              <span
                className={pillClassName(syncNotice.publicCheckoutEnabled ? "success" : "muted")}
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
                <p className="subtle-text">Active tiers newly mirrored after refresh</p>
              </div>
              <div className="console-signal-card">
                <span className="console-kpi-label">Ticket tiers removed</span>
                <strong>{syncNotice.ticketsRemoved}</strong>
                <p className="subtle-text">Previously active tiers no longer in the current feed</p>
              </div>
              <div className="console-signal-card">
                <span className="console-kpi-label">Mirrored tiers now</span>
                <strong>{syncNotice.mirroredTicketCount}</strong>
                <p className="subtle-text">
                  {syncNotice.enabledTicketCount} currently eligible for public checkout
                </p>
              </div>
              <div className="console-signal-card">
                <span className="console-kpi-label">Synced at</span>
                <strong>
                  {syncNotice.syncedAt ? <LocalDateTime iso={syncNotice.syncedAt} /> : "n/a"}
                </strong>
                <p className="subtle-text">Full-calendar refresh, event-focused summary</p>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {eventGroups.length === 0 ? (
        <div className="console-detail-card">
          <h3>No future events</h3>
          <p className="subtle-text">
            Event-focused sync and ticket settings only appear for events whose start time is still
            in the future.
          </p>
        </div>
      ) : null}

      {eventGroups.map(({ calendar, events, upstreamEvents, upstreamError }) => (
        <section className="console-content" key={calendar.calendar_connection_id}>
          <div className="console-section-header">
            <div>
              <h3>{calendar.display_name}</h3>
              <p className="subtle-text tenant-event-section-summary">
                {events.length} mirrored event{events.length === 1 ? "" : "s"} ·{" "}
                {events.filter((event) => event.zcash_enabled).length} with public checkout live ·{" "}
                {upstreamEvents.length} available to import
              </p>
            </div>
            <form action={validateAndSyncCalendarAction}>
              <input
                name="calendar_connection_id"
                type="hidden"
                value={calendar.calendar_connection_id}
              />
              <input name="tenant_slug" type="hidden" value={detail.tenant.slug} />
              <input name="redirect_to" type="hidden" value={`${basePath}/events`} />
              <button className="button button-secondary button-small" type="submit">
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
            <ConsoleDisclosure
              defaultOpen={syncNotice?.focus === "upstream" || events.length === 0}
              description={`${upstreamEvents.length} upcoming Luma event${upstreamEvents.length === 1 ? "" : "s"} available to import when you are ready.`}
              title="Available to import"
            >
              <div className="tenant-event-list">
                {upstreamEvents.map((event) => (
                  <article className="console-detail-card tenant-event-card" key={event.api_id}>
                    <div className="tenant-event-head">
                      <div className="tenant-event-hero">
                        {event.cover_url ? (
                          <div className="tenant-event-media">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img alt={event.name} src={event.cover_url} />
                          </div>
                        ) : (
                          <div className="tenant-event-media tenant-event-media-fallback">
                            <span>{event.name.slice(0, 2).toUpperCase()}</span>
                          </div>
                        )}
                        <div className="tenant-event-copy">
                          <p className="console-kpi-label">Import candidate</p>
                          <h4>{event.name}</h4>
                          <p className="subtle-text">
                            <LocalDateTime iso={event.start_at} />
                            {event.location_label ? ` · ${event.location_label}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="console-mini-pill-row tenant-event-pills">
                        {upstreamEventBadges().map((badge) => (
                          <span className={pillClassName(badge.tone)} key={badge.label}>
                            {badge.label}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="tenant-event-summary-grid">
                      <div className="tenant-event-summary-card">
                        <span className="console-kpi-label">Status</span>
                        <strong>Not mirrored yet</strong>
                        <p className="subtle-text">This event is still outside your managed workspace.</p>
                      </div>
                      <div className="tenant-event-summary-card">
                        <span className="console-kpi-label">Public checkout</span>
                        <strong>Still hidden</strong>
                        <p className="subtle-text">
                          Nothing appears on the public calendar until ticket review is complete.
                        </p>
                      </div>
                    </div>

                    <div className="button-row tenant-event-actions">
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
                      <form action={syncCalendarEventAction}>
                        <input
                          name="calendar_connection_id"
                          type="hidden"
                          value={calendar.calendar_connection_id}
                        />
                        <input name="tenant_slug" type="hidden" value={detail.tenant.slug} />
                        <input name="event_api_id" type="hidden" value={event.api_id} />
                        <input name="event_name" type="hidden" value={event.name} />
                        <input name="focus" type="hidden" value="upstream" />
                        <input name="redirect_to" type="hidden" value={`${basePath}/events`} />
                        <button className="button button-secondary button-small" type="submit">
                          Import and refresh event
                        </button>
                      </form>
                    </div>
                  </article>
                ))}
              </div>
            </ConsoleDisclosure>
          ) : null}

          <div className="tenant-event-list">
            {events.map((event) => {
              const mirroredTickets = detail.tickets_by_event.get(event.event_api_id) || [];
              const enabledTicketCount = countEnabledTickets(mirroredTickets);
              const publicEventHref = event.zcash_enabled
                ? `/c/${calendar.slug}/events/${encodeURIComponent(event.event_api_id)}`
                : null;

              return (
                <article className="console-detail-card tenant-event-card" key={event.event_api_id}>
                  <div className="tenant-event-head">
                    <div className="tenant-event-hero">
                      {event.cover_url ? (
                        <div className="tenant-event-media">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img alt={event.name} src={event.cover_url} />
                        </div>
                      ) : (
                        <div className="tenant-event-media tenant-event-media-fallback">
                          <span>{event.name.slice(0, 2).toUpperCase()}</span>
                        </div>
                      )}
                      <div className="tenant-event-copy">
                        <p className="console-kpi-label">Mirrored event</p>
                        <h4>{event.name}</h4>
                        <p className="subtle-text">
                          <LocalDateTime iso={event.start_at} />
                          {event.location_label ? ` · ${event.location_label}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="console-mini-pill-row tenant-event-pills">
                      {mirroredEventBadges(event).map((badge) => (
                        <span className={pillClassName(badge.tone)} key={badge.label}>
                          {badge.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="tenant-event-summary-grid">
                    <div className="tenant-event-summary-card">
                      <span className="console-kpi-label">Ticket tiers</span>
                      <strong>
                        {mirroredTickets.length} mirrored · {enabledTicketCount} ready
                      </strong>
                      <p className="subtle-text">
                        {enabledTicketCount > 0
                          ? "At least one ticket can already be used for public checkout."
                          : "Open ticket settings when you are ready to review requirements."}
                      </p>
                    </div>
                    <div className="tenant-event-summary-card">
                      <span className="console-kpi-label">Public page</span>
                      <strong>{publicEventHref ? "Live" : "Hidden"}</strong>
                      <p className="subtle-text">
                        {event.zcash_enabled_reason || "No public checkout reason recorded yet."}
                      </p>
                    </div>
                    <div className="tenant-event-summary-card">
                      <span className="console-kpi-label">Sync state</span>
                      <strong>{syncStatusLabel(event.sync_status)}</strong>
                      <p className="subtle-text">
                        Refresh this event if you made changes in Luma and want a fresh summary.
                      </p>
                    </div>
                  </div>

                  <div className="button-row tenant-event-actions">
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
                      <Link className="button button-secondary button-small" href={publicEventHref}>
                        Open public event
                      </Link>
                    ) : null}
                    <form action={syncCalendarEventAction}>
                      <input
                        name="calendar_connection_id"
                        type="hidden"
                        value={calendar.calendar_connection_id}
                      />
                      <input name="tenant_slug" type="hidden" value={detail.tenant.slug} />
                      <input name="event_api_id" type="hidden" value={event.event_api_id} />
                      <input name="event_name" type="hidden" value={event.name} />
                      <input name="focus" type="hidden" value="mirrored" />
                      <input name="redirect_to" type="hidden" value={`${basePath}/events`} />
                      <button className="button button-secondary button-small" type="submit">
                        Sync this event
                      </button>
                    </form>
                  </div>

                  <ConsoleDisclosure
                    description={`${enabledTicketCount} of ${mirroredTickets.length} ticket tier${mirroredTickets.length === 1 ? "" : "s"} ready for public checkout.`}
                    title="Review ticket settings"
                  >
                    {mirroredTickets.length ? (
                      <div className="tenant-ticket-grid">
                        {mirroredTickets.map((ticket) => (
                          <form
                            action={setTicketAssertionsAction}
                            className="tenant-ticket-card"
                            key={ticket.ticket_type_api_id}
                          >
                            <input name="tenant_slug" type="hidden" value={detail.tenant.slug} />
                            <input
                              name="calendar_connection_id"
                              type="hidden"
                              value={calendar.calendar_connection_id}
                            />
                            <input name="event_api_id" type="hidden" value={ticket.event_api_id} />
                            <input
                              name="ticket_type_api_id"
                              type="hidden"
                              value={ticket.ticket_type_api_id}
                            />
                            <input name="redirect_to" type="hidden" value={`${basePath}/events`} />

                            <div className="tenant-ticket-head">
                              <div>
                                <div className="console-inline-action">
                                  <span className={pillClassName(ticketReviewTone(ticket))}>
                                    {ticketReviewLabel(ticket)}
                                  </span>
                                </div>
                                <h4>{ticket.name}</h4>
                                <p className="subtle-text tenant-ticket-price">
                                  {ticket.amount != null && ticket.currency
                                    ? `${ticket.currency} ${ticket.amount.toFixed(2)}`
                                    : "Pricing unavailable"}
                                </p>
                              </div>
                            </div>

                            {ticket.description ? (
                              <p className="subtle-text">{ticket.description}</p>
                            ) : null}

                            <div className="tenant-ticket-checks">
                              <label className="console-checkbox">
                                <input
                                  defaultChecked={ticket.confirmed_fixed_price}
                                  name="confirmed_fixed_price"
                                  type="checkbox"
                                />
                                <span>Fixed price confirmed</span>
                              </label>
                              <label className="console-checkbox">
                                <input
                                  defaultChecked={ticket.confirmed_no_approval_required}
                                  name="confirmed_no_approval_required"
                                  type="checkbox"
                                />
                                <span>No approval required</span>
                              </label>
                              <label className="console-checkbox">
                                <input
                                  defaultChecked={ticket.confirmed_no_extra_required_questions}
                                  name="confirmed_no_extra_required_questions"
                                  type="checkbox"
                                />
                                <span>No extra required questions</span>
                              </label>
                            </div>

                            <p className="subtle-text">{ticketReviewCopy(ticket)}</p>

                            <button className="button button-secondary button-small" type="submit">
                              Save ticket settings
                            </button>
                          </form>
                        ))}
                      </div>
                    ) : (
                      <p className="subtle-text">
                        No mirrored ticket tiers are available for this event yet.
                      </p>
                    )}
                  </ConsoleDisclosure>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </section>
  );
}
