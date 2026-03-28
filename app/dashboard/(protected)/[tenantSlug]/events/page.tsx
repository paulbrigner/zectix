import Link from "next/link";
import { notFound } from "next/navigation";
import {
  setTicketAssertionsAction,
  syncCalendarEventAction,
  validateAndSyncCalendarAction,
} from "@/app/dashboard/actions";
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
    { label: "Event-focused import path", tone: "info" as const },
  ];
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
      const events = (eventsByCalendarId.get(calendar.calendar_connection_id) || []).filter(
        (event) => isFutureEvent(event.start_at),
      );
      const mirroredEventIds = new Set(events.map((event) => event.event_api_id));
      const upstreamPreview =
        detail.upstream_luma_events_by_calendar.get(calendar.calendar_connection_id) || null;
      const upstreamEvents =
        upstreamPreview?.events.filter(
          (event) => isFutureEvent(event.start_at) && !mirroredEventIds.has(event.api_id),
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
        events.length > 0 || upstreamEvents.length > 0 || Boolean(upstreamError),
    );

  const basePath = `/dashboard/${encodeURIComponent(detail.tenant.slug)}`;

  return (
    <section className="console-section">
      <div className="console-section-header">
        <div>
          <h2>Events and tickets</h2>
          <p className="subtle-text">
            Use event-focused sync actions to review one event at a time without changing the
            backend&apos;s full-calendar mirror model. Imported events still land behind the
            existing ticket-eligibility checks before public checkout exposure.
          </p>
        </div>
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
            Event-focused sync and ticket settings only appear for events whose start time is still in the future.
          </p>
        </div>
      ) : null}

      {eventGroups.map(({ calendar, events, upstreamEvents, upstreamError }) => (
        <section className="console-content" key={calendar.calendar_connection_id}>
          <div className="console-section-header">
            <div>
              <h3>{calendar.display_name}</h3>
              <p className="subtle-text">
                Use the per-event controls below for targeted review. The backend still runs
                the existing full-calendar refresh, but each result is summarized as an
                event-focused diff.
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
            <div className="console-detail-card">
              <div className="console-section-header">
                <div>
                  <p className="console-kpi-label">Available from Luma but not yet mirrored</p>
                  <h3>Upstream-only events</h3>
                  <p className="subtle-text">
                    Import one event at a time into mirrored inventory. Imported tickets still
                    need to satisfy the existing eligibility checks before public checkout can go live.
                  </p>
                </div>
              </div>

              <div className="console-preview-list">
                {upstreamEvents.map((event) => (
                  <article className="console-preview-card" key={event.api_id}>
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
                          <p className="console-kpi-label">{calendar.display_name}</p>
                          <h4>{event.name}</h4>
                        </div>
                        <div className="console-mini-pill-row">
                          {upstreamEventBadges().map((badge) => (
                            <span className={pillClassName(badge.tone)} key={badge.label}>
                              {badge.label}
                            </span>
                          ))}
                        </div>
                      </div>
                      <p className="subtle-text">
                        <LocalDateTime iso={event.start_at} />
                        {event.location_label ? ` · ${event.location_label}` : ""}
                      </p>
                      <div className="button-row">
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
                            Sync this event
                          </button>
                        </form>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          <div className="console-card-grid">
            {events.map((event) => {
              const mirroredTickets = detail.tickets_by_event.get(event.event_api_id) || [];
              const publicEventHref = event.zcash_enabled
                ? `/c/${calendar.slug}/events/${encodeURIComponent(event.event_api_id)}`
                : null;

              return (
                <article className="console-detail-card" key={event.event_api_id}>
                  <div className="console-section-header">
                    <div>
                      <p className="console-kpi-label">{calendar.display_name}</p>
                      <h3>{event.name}</h3>
                      <p className="subtle-text">
                        <LocalDateTime iso={event.start_at} />
                        {event.location_label ? ` · ${event.location_label}` : ""}
                      </p>
                    </div>
                    <div className="console-mini-pill-row">
                      {mirroredEventBadges(event).map((badge) => (
                        <span className={pillClassName(badge.tone)} key={badge.label}>
                          {badge.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  <p className="subtle-text">
                    {mirroredTickets.length} mirrored ticket{mirroredTickets.length === 1 ? "" : "s"} ·{" "}
                    {mirroredTickets.filter((ticket) => ticket.zcash_enabled).length} enabled for public checkout
                  </p>
                  <p className="subtle-text">
                    {event.zcash_enabled_reason || "No public checkout reason recorded yet."}
                  </p>

                  <div className="button-row">
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

                  <div className="console-content">
                    {mirroredTickets.map((ticket) => (
                      <form
                        action={setTicketAssertionsAction}
                        className="console-detail-card"
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

                        <div className="console-section-header">
                          <div>
                            <p className="console-kpi-label">
                              {ticket.zcash_enabled ? "Public checkout enabled" : "Needs review"}
                            </p>
                            <h4>{ticket.name}</h4>
                            <p className="subtle-text">
                              {ticket.amount != null && ticket.currency
                                ? `${ticket.currency} ${ticket.amount.toFixed(2)}`
                                : "Pricing unavailable"}
                            </p>
                            {ticket.description ? (
                              <p className="subtle-text">{ticket.description}</p>
                            ) : null}
                          </div>
                        </div>

                        <div className="public-field-grid">
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

                        {ticket.automatic_eligibility_reasons.length ? (
                          <p className="subtle-text">
                            Automatic review: {ticket.automatic_eligibility_reasons.join(" · ")}
                          </p>
                        ) : (
                          <p className="subtle-text">
                            Automatic review passed for the standard managed checkout checks.
                          </p>
                        )}

                        <button className="button button-secondary button-small" type="submit">
                          Save ticket settings
                        </button>
                      </form>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </section>
  );
}
