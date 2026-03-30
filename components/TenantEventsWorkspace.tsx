import Link from "next/link";
import {
  setTicketAssertionsAction,
  syncCalendarEventAction,
  validateAndSyncCalendarAction,
} from "@/app/dashboard/actions";
import { LocalDateTime } from "@/components/LocalDateTime";
import { formatFiatAmount } from "@/lib/app-state/utils";
import type { TicketMirror } from "@/lib/app-state/types";
import type { TenantOpsDetail } from "@/lib/tenancy/service";
import {
  buildTenantEventWorkspaceRows,
  matchesTenantEventWorkspaceFilter,
  type TenantEventWorkspaceFilter,
  type TenantEventWorkspaceRow,
  type TenantEventWorkspaceTone,
} from "@/lib/tenant-self-serve";

type SearchParamValue = string | string[] | undefined;
type SyncNotice = {
  enabledTicketCount: number;
  error: string | null;
  eventId: string | null;
  eventName: string;
  focus: "mirrored" | "upstream";
  mirroredTicketCount: number;
  outcome:
    | "imported"
    | "updated"
    | "unchanged"
    | "hidden"
    | "canceled"
    | "missing"
    | null;
  publicCheckoutEnabled: boolean;
  syncStatus: string | null;
  syncedAt: string | null;
  ticketsAdded: number;
  ticketsRemoved: number;
};

function readSearchValue(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

function readIntSearchValue(value: SearchParamValue) {
  const parsed = Number(readSearchValue(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function readWorkspaceFilter(value: SearchParamValue): TenantEventWorkspaceFilter {
  const normalized = readSearchValue(value);
  switch (normalized) {
    case "needs_attention":
    case "live":
    case "hidden":
    case "import_candidates":
      return normalized;
    case "all":
    default:
      return "all";
  }
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
    enabledTicketCount: readIntSearchValue(searchParams.sync_enabled),
    error,
    eventId,
    eventName,
    focus: readSearchValue(searchParams.sync_focus) === "upstream" ? "upstream" : "mirrored",
    mirroredTicketCount: readIntSearchValue(searchParams.sync_mirrored),
    outcome:
      outcome === "imported" ||
      outcome === "updated" ||
      outcome === "unchanged" ||
      outcome === "hidden" ||
      outcome === "canceled" ||
      outcome === "missing"
        ? outcome
        : null,
    publicCheckoutEnabled: readSearchValue(searchParams.sync_public) === "1",
    syncStatus: readSearchValue(searchParams.sync_status) || null,
    syncedAt: readSearchValue(searchParams.sync_at) || null,
    ticketsAdded: readIntSearchValue(searchParams.sync_added),
    ticketsRemoved: readIntSearchValue(searchParams.sync_removed),
  };
}

function pillClassName(tone: TenantEventWorkspaceTone) {
  return `console-mini-pill console-mini-pill-${tone}`;
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

function ticketReviewTone(ticket: TicketMirror): TenantEventWorkspaceTone {
  if (ticket.zcash_enabled) {
    return "success";
  }
  if (ticket.automatic_eligibility_reasons.length) {
    return "warning";
  }
  return "muted";
}

function ticketReviewLabel(ticket: TicketMirror) {
  if (ticket.zcash_enabled) {
    return "Ready for checkout";
  }
  if (ticket.automatic_eligibility_reasons.length) {
    return "Needs attention";
  }
  return "Needs confirmation";
}

function ticketReviewCopy(ticket: TicketMirror) {
  if (ticket.automatic_eligibility_reasons.length) {
    return `Automatic review: ${ticket.automatic_eligibility_reasons.join(" · ")}`;
  }
  if (ticket.zcash_enabled) {
    return "This ticket is already available for managed public checkout.";
  }
  return "Automatic review passed. Confirm the organizer-side requirements below to enable checkout.";
}

function rowSearchText(row: TenantEventWorkspaceRow) {
  return [
    row.event_name,
    row.calendar.display_name,
    row.location_label || "",
    row.source === "upstream" ? "import candidate" : "mirrored event",
  ]
    .join(" ")
    .toLowerCase();
}

function buildEventsHref(
  tenantBasePath: string,
  filters: {
    calendar: string;
    q: string;
    state: TenantEventWorkspaceFilter;
  },
  selectedRowId?: string | null,
) {
  const params = new URLSearchParams();
  if (filters.q) {
    params.set("q", filters.q);
  }
  if (filters.state !== "all") {
    params.set("state", filters.state);
  }
  if (filters.calendar !== "all") {
    params.set("calendar", filters.calendar);
  }
  if (selectedRowId) {
    params.set("selected", selectedRowId);
  }

  const query = params.toString();
  return `${tenantBasePath}/events${query ? `?${query}` : ""}`;
}

function selectionLabel() {
  return "Open";
}

function sourceLabel(row: TenantEventWorkspaceRow) {
  return row.source === "upstream" ? "Import candidate" : "Mirrored";
}

function sourceTone(row: TenantEventWorkspaceRow): TenantEventWorkspaceTone {
  return row.source === "upstream" ? "warning" : "info";
}

function selectedRowFromSyncNotice(
  rows: TenantEventWorkspaceRow[],
  notice: SyncNotice | null,
) {
  if (!notice?.eventId) {
    return null;
  }

  return (
    rows.find(
      (row) =>
        row.event_id === notice.eventId &&
        row.source === (notice.focus === "upstream" ? "upstream" : "mirrored"),
    ) ||
    rows.find((row) => row.event_id === notice.eventId) ||
    null
  );
}

export function TenantEventsWorkspace({
  detail,
  searchParams,
  tenantBasePath,
}: {
  detail: TenantOpsDetail;
  searchParams: Record<string, SearchParamValue>;
  tenantBasePath: string;
}) {
  const eventsPath = `${tenantBasePath}/events`;
  const syncNotice = readSyncNotice(searchParams);
  const rows = buildTenantEventWorkspaceRows(detail);
  const searchQuery = (readSearchValue(searchParams.q) || "").trim();
  const stateFilter = readWorkspaceFilter(searchParams.state);
  const rawCalendarFilter = readSearchValue(searchParams.calendar) || "all";
  const calendarFilter =
    rawCalendarFilter === "all" ||
    detail.calendars.some(
      (calendar) => calendar.calendar_connection_id === rawCalendarFilter,
    )
      ? rawCalendarFilter
      : "all";
  const filters = {
    calendar: calendarFilter,
    q: searchQuery,
    state: stateFilter,
  };
  const normalizedQuery = searchQuery.toLowerCase();
  const visibleRows = rows.filter((row) => {
    if (
      filters.calendar !== "all" &&
      row.calendar.calendar_connection_id !== filters.calendar
    ) {
      return false;
    }

    if (!matchesTenantEventWorkspaceFilter(row, filters.state)) {
      return false;
    }

    if (normalizedQuery && !rowSearchText(row).includes(normalizedQuery)) {
      return false;
    }

    return true;
  });
  const selectedParam = readSearchValue(searchParams.selected) || null;
  const selectedRow =
    visibleRows.find((row) => row.row_id === selectedParam) ||
    selectedRowFromSyncNotice(visibleRows, syncNotice) ||
    visibleRows[0] ||
    null;
  const selectedHref = buildEventsHref(
    tenantBasePath,
    filters,
    selectedRow?.row_id || null,
  );
  const mirroredEventCount = rows.filter((row) => row.source === "mirrored").length;
  const liveEventCount = rows.filter((row) => row.public_status_label === "Live").length;
  const needsAttentionCount = rows.filter((row) =>
    matchesTenantEventWorkspaceFilter(row, "needs_attention"),
  ).length;
  const importCandidateCount = rows.filter((row) => row.source === "upstream").length;
  const feedIssues = detail.calendars
    .map((calendar) => ({
      calendar,
      error:
        detail.upstream_luma_events_by_calendar.get(calendar.calendar_connection_id)?.error || null,
    }))
    .filter((entry) => entry.error);

  return (
    <div className="console-page-body">
      <section className="console-section">
        <div className="console-section-header">
          <div>
            <h2>Events and tickets</h2>
            <p className="subtle-text">
              Use this review queue to scan upcoming events, filter for blockers, and handle sync,
              import, and ticket decisions from one place.
            </p>
          </div>
        </div>

        <div className="console-kpi-grid">
          <article className="console-kpi-card">
            <p className="console-kpi-label">Mirrored events</p>
            <p className="console-kpi-value">{mirroredEventCount}</p>
            <p className="subtle-text console-kpi-detail">
              future event{mirroredEventCount === 1 ? "" : "s"} already in the workspace
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
            <p className="console-kpi-label">Needs attention</p>
            <p className="console-kpi-value">{needsAttentionCount}</p>
            <p className="subtle-text console-kpi-detail">
              event{needsAttentionCount === 1 ? "" : "s"} worth reviewing next
            </p>
          </article>
          <article className="console-kpi-card">
            <p className="console-kpi-label">Import candidates</p>
            <p className="console-kpi-value">{importCandidateCount}</p>
            <p className="subtle-text console-kpi-detail">
              upstream Luma event{importCandidateCount === 1 ? "" : "s"} not yet mirrored
            </p>
          </article>
        </div>
      </section>

      {syncNotice ? (
        <section
          className={`console-section console-sync-feedback${syncNotice.error ? " console-sync-feedback-error" : ""}`}
        >
          <div className="console-section-header">
            <div>
              <p className="console-kpi-label">{focusLabel(syncNotice.focus)}</p>
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
                <span className={pillClassName("info")}>{syncNotice.syncStatus}</span>
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
        </section>
      ) : null}

      {feedIssues.length ? (
        <section className="console-section">
          <div className="console-section-header">
            <div>
              <h2>Feed issues</h2>
              <p className="subtle-text">
                These calendars need attention before the event workspace can reflect the latest
                upstream state.
              </p>
            </div>
          </div>
          <div className="console-card-grid">
            {feedIssues.map(({ calendar, error }) => (
              <article className="console-detail-card" key={calendar.calendar_connection_id}>
                <p className="console-kpi-label">{calendar.display_name}</p>
                <h3>Could not load current Luma events</h3>
                <p className="subtle-text">{error}</p>
                <form action={validateAndSyncCalendarAction}>
                  <input
                    name="calendar_connection_id"
                    type="hidden"
                    value={calendar.calendar_connection_id}
                  />
                  <input name="tenant_slug" type="hidden" value={detail.tenant.slug} />
                  <input name="redirect_to" type="hidden" value={selectedHref} />
                  <button className="button button-secondary button-small" type="submit">
                    Refresh whole calendar
                  </button>
                </form>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <div className="tenant-events-workspace">
        <section className="console-section tenant-events-table-panel">
          <div className="console-section-header">
            <div>
              <h2>Review queue</h2>
              <p className="subtle-text">
                Showing {visibleRows.length} of {rows.length} upcoming event
                {rows.length === 1 ? "" : "s"}.
              </p>
            </div>
          </div>

          <form className="tenant-events-filter-form" method="get">
            <div className="tenant-events-filter-grid">
              <label className="console-field">
                <span>Search</span>
                <input
                  className="console-input"
                  defaultValue={searchQuery}
                  name="q"
                  placeholder="Search event, calendar, or location"
                  type="search"
                />
              </label>
              <label className="console-field">
                <span>Status</span>
                <select className="console-input" defaultValue={stateFilter} name="state">
                  <option value="all">All upcoming events</option>
                  <option value="needs_attention">Needs attention</option>
                  <option value="live">Live publicly</option>
                  <option value="hidden">Hidden mirrored events</option>
                  <option value="import_candidates">Import candidates</option>
                </select>
              </label>
              <label className="console-field">
                <span>Calendar</span>
                <select className="console-input" defaultValue={calendarFilter} name="calendar">
                  <option value="all">All calendars</option>
                  {detail.calendars.map((calendar) => (
                    <option
                      key={calendar.calendar_connection_id}
                      value={calendar.calendar_connection_id}
                    >
                      {calendar.display_name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="button-row tenant-events-filter-actions">
              <button className="button button-secondary button-small" type="submit">
                Apply filters
              </button>
              <Link className="button button-secondary button-small" href={eventsPath}>
                Reset
              </Link>
            </div>
          </form>

          {!visibleRows.length ? (
            <div className="console-preview-empty">
              <strong>No events match the current filters</strong>
              <p className="subtle-text">
                Try clearing a filter or broadening the search to bring more events back into view.
              </p>
            </div>
          ) : (
            <div className="console-table-wrap">
              <table className="console-table tenant-events-table">
                <thead>
                  <tr>
                    <th className="tenant-events-cell-event">Event</th>
                    <th className="tenant-events-cell-calendar">Calendar</th>
                    <th className="tenant-events-cell-when">When</th>
                    <th className="tenant-events-cell-source">Source</th>
                    <th className="tenant-events-cell-checkout">Checkout</th>
                    <th className="tenant-events-cell-tickets">Tickets</th>
                    <th className="tenant-events-cell-blocker">Main blocker</th>
                    <th className="tenant-events-cell-sync">Last sync</th>
                    <th className="tenant-events-cell-action">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => {
                    const rowHref = buildEventsHref(tenantBasePath, filters, row.row_id);
                    const selected = selectedRow?.row_id === row.row_id;
                    return (
                      <tr
                        className={selected ? "tenant-events-table-row-active" : undefined}
                        key={row.row_id}
                      >
                        <td className="tenant-events-cell-event">
                          <div className="console-table-cell-stack">
                            <strong>{row.event_name}</strong>
                            <p className="subtle-text console-table-note">
                              {row.location_label || "Location not specified"}
                            </p>
                          </div>
                        </td>
                        <td className="tenant-events-cell-calendar">{row.calendar.display_name}</td>
                        <td className="tenant-events-cell-when">
                          <span className="tenant-events-time">
                            <LocalDateTime iso={row.start_at} />
                          </span>
                        </td>
                        <td className="tenant-events-cell-source">
                          <span className={pillClassName(sourceTone(row))}>
                            {sourceLabel(row)}
                          </span>
                        </td>
                        <td className="tenant-events-cell-checkout">
                          <span className={pillClassName(row.public_status_tone)}>
                            {row.public_status_label}
                          </span>
                        </td>
                        <td className="tenant-events-cell-tickets">
                          {row.source === "mirrored" ? (
                            <div className="console-table-cell-stack">
                              <strong>
                                {row.enabled_ticket_count}/{row.ticket_count} ready
                              </strong>
                              <p className="subtle-text console-table-note">
                                {row.needs_attention_count} needing review
                              </p>
                            </div>
                          ) : (
                            <span className="subtle-text">Import first</span>
                          )}
                        </td>
                        <td className="tenant-events-cell-blocker">{row.primary_blocker}</td>
                        <td className="tenant-events-cell-sync">
                          {row.last_synced_at ? (
                            <span className="tenant-events-time">
                              <LocalDateTime iso={row.last_synced_at} />
                            </span>
                          ) : (
                            <span className="subtle-text">
                              {row.source === "upstream" ? "Upstream only" : "Not yet synced"}
                            </span>
                          )}
                        </td>
                        <td className="tenant-events-cell-action">
                          <Link className="button button-secondary button-small" href={rowHref}>
                            {selectionLabel()}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="console-section tenant-events-detail-panel">
          {!selectedRow ? (
            <div className="console-preview-empty">
              <strong>Select an event to review details</strong>
              <p className="subtle-text">
                Pick a row from the review queue to inspect its sync state, actions, and ticket
                review controls.
              </p>
            </div>
          ) : (
            <>
              <div className="tenant-events-detail-hero">
                {selectedRow.cover_url ? (
                  <div className="tenant-event-media tenant-events-detail-media">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt={selectedRow.event_name} src={selectedRow.cover_url} />
                  </div>
                ) : (
                  <div className="tenant-event-media tenant-event-media-fallback tenant-events-detail-media">
                    <span>{selectedRow.event_name.slice(0, 2).toUpperCase()}</span>
                  </div>
                )}
                <div className="tenant-event-copy tenant-events-detail-copy">
                  <div className="console-mini-pill-row tenant-events-detail-pills">
                    <span className={pillClassName(sourceTone(selectedRow))}>
                      {sourceLabel(selectedRow)}
                    </span>
                    <span className={pillClassName(selectedRow.public_status_tone)}>
                      {selectedRow.public_status_label}
                    </span>
                    <span className={pillClassName(selectedRow.sync_status_tone)}>
                      {selectedRow.sync_status_label}
                    </span>
                  </div>
                  <h3>{selectedRow.event_name}</h3>
                  <p className="subtle-text">
                    <LocalDateTime iso={selectedRow.start_at} />
                    {selectedRow.location_label ? ` · ${selectedRow.location_label}` : ""}
                  </p>
                  <p className="subtle-text">
                    Calendar {selectedRow.calendar.display_name} · {selectedRow.primary_blocker}
                  </p>
                </div>
              </div>

              <div className="console-signal-grid tenant-events-detail-signals">
                <div className="console-signal-card">
                  <span className="console-kpi-label">Checkout</span>
                  <strong>{selectedRow.public_status_label}</strong>
                  <p className="subtle-text">{selectedRow.primary_blocker}</p>
                </div>
                <div className="console-signal-card">
                  <span className="console-kpi-label">Tickets ready</span>
                  <strong>
                    {selectedRow.source === "mirrored"
                      ? `${selectedRow.enabled_ticket_count}/${selectedRow.ticket_count}`
                      : "Import first"}
                  </strong>
                  <p className="subtle-text">
                    {selectedRow.source === "mirrored"
                      ? `${selectedRow.needs_attention_count} needing review`
                      : "Ticket review starts after import"}
                  </p>
                </div>
                <div className="console-signal-card">
                  <span className="console-kpi-label">Sync state</span>
                  <strong>{selectedRow.sync_status_label}</strong>
                  <p className="subtle-text">
                    {selectedRow.last_synced_at ? (
                      <LocalDateTime iso={selectedRow.last_synced_at} />
                    ) : (
                      "No mirrored sync has been recorded yet."
                    )}
                  </p>
                </div>
              </div>

              <div className="button-row tenant-events-detail-actions">
                {selectedRow.event_url ? (
                  <a
                    className="button button-secondary button-small"
                    href={selectedRow.event_url}
                    rel="noreferrer noopener"
                    target="_blank"
                  >
                    Open on Luma
                  </a>
                ) : null}

                {selectedRow.source === "mirrored" &&
                selectedRow.mirrored_event?.zcash_enabled ? (
                  <Link
                    className="button button-secondary button-small"
                    href={`/c/${selectedRow.calendar.slug}/events/${encodeURIComponent(selectedRow.event_id)}`}
                  >
                    Open public event
                  </Link>
                ) : null}

                <form action={syncCalendarEventAction}>
                  <input
                    name="calendar_connection_id"
                    type="hidden"
                    value={selectedRow.calendar.calendar_connection_id}
                  />
                  <input name="tenant_slug" type="hidden" value={detail.tenant.slug} />
                  <input name="event_api_id" type="hidden" value={selectedRow.event_id} />
                  <input name="event_name" type="hidden" value={selectedRow.event_name} />
                  <input
                    name="focus"
                    type="hidden"
                    value={selectedRow.source === "upstream" ? "upstream" : "mirrored"}
                  />
                  <input name="redirect_to" type="hidden" value={selectedHref} />
                  <button className="button button-secondary button-small" type="submit">
                    {selectedRow.source === "upstream"
                      ? "Import and refresh event"
                      : "Sync this event"}
                  </button>
                </form>

                <form action={validateAndSyncCalendarAction}>
                  <input
                    name="calendar_connection_id"
                    type="hidden"
                    value={selectedRow.calendar.calendar_connection_id}
                  />
                  <input name="tenant_slug" type="hidden" value={detail.tenant.slug} />
                  <input name="redirect_to" type="hidden" value={selectedHref} />
                  <button className="button button-secondary button-small" type="submit">
                    Refresh whole calendar
                  </button>
                </form>
              </div>

              {selectedRow.source === "upstream" ? (
                <div className="console-preview-empty">
                  <strong>Import to start ticket review</strong>
                  <p className="subtle-text">
                    This event is visible from the saved Luma key but is not yet part of your
                    mirrored checkout workspace. Import it first, then review its mirrored ticket
                    tiers here.
                  </p>
                </div>
              ) : selectedRow.tickets.length ? (
                <section className="tenant-events-ticket-section">
                  <div className="console-section-header">
                    <div>
                      <h2>Ticket review</h2>
                      <p className="subtle-text">
                        Confirm organizer-side requirements for each mirrored ticket tier.
                      </p>
                    </div>
                  </div>

                  <div className="console-table-wrap">
                    <table className="console-table tenant-events-ticket-table">
                      <thead>
                        <tr>
                          <th>Ticket</th>
                          <th>Price</th>
                          <th>Status</th>
                          <th>Review controls</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedRow.tickets.map((ticket) => (
                          <tr key={ticket.ticket_type_api_id}>
                            <td>
                              <div className="console-table-cell-stack">
                                <strong>{ticket.name}</strong>
                                {ticket.description ? (
                                  <p className="subtle-text console-table-note">
                                    {ticket.description}
                                  </p>
                                ) : null}
                              </div>
                            </td>
                            <td>{formatFiatAmount(ticket.amount, ticket.currency)}</td>
                            <td>
                              <div className="console-table-cell-stack">
                                <span className={pillClassName(ticketReviewTone(ticket))}>
                                  {ticketReviewLabel(ticket)}
                                </span>
                                <p className="subtle-text console-table-note">
                                  {ticketReviewCopy(ticket)}
                                </p>
                              </div>
                            </td>
                            <td>
                              <form
                                action={setTicketAssertionsAction}
                                className="tenant-ticket-review-form"
                              >
                                <input name="tenant_slug" type="hidden" value={detail.tenant.slug} />
                                <input
                                  name="calendar_connection_id"
                                  type="hidden"
                                  value={selectedRow.calendar.calendar_connection_id}
                                />
                                <input name="event_api_id" type="hidden" value={ticket.event_api_id} />
                                <input
                                  name="ticket_type_api_id"
                                  type="hidden"
                                  value={ticket.ticket_type_api_id}
                                />
                                <input name="redirect_to" type="hidden" value={selectedHref} />

                                <div className="tenant-ticket-review-checks">
                                  <label className="console-checkbox tenant-ticket-review-check">
                                    <input
                                      defaultChecked={ticket.confirmed_fixed_price}
                                      name="confirmed_fixed_price"
                                      type="checkbox"
                                    />
                                    <span>Fixed price confirmed</span>
                                  </label>
                                  <label className="console-checkbox tenant-ticket-review-check">
                                    <input
                                      defaultChecked={ticket.confirmed_no_approval_required}
                                      name="confirmed_no_approval_required"
                                      type="checkbox"
                                    />
                                    <span>No approval required</span>
                                  </label>
                                  <label className="console-checkbox tenant-ticket-review-check">
                                    <input
                                      defaultChecked={
                                        ticket.confirmed_no_extra_required_questions
                                      }
                                      name="confirmed_no_extra_required_questions"
                                      type="checkbox"
                                    />
                                    <span>No extra required questions</span>
                                  </label>
                                </div>

                                <button
                                  className="button button-secondary button-small"
                                  type="submit"
                                >
                                  Save ticket review
                                </button>
                              </form>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : (
                <div className="console-preview-empty">
                  <strong>No mirrored ticket tiers are available yet</strong>
                  <p className="subtle-text">
                    Re-sync this event after making ticket changes in Luma to refresh the mirrored
                    checkout inventory.
                  </p>
                </div>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
