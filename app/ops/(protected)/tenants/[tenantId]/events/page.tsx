import Link from "next/link";
import { notFound } from "next/navigation";
import {
  setTicketAssertionsAction,
  validateAndSyncCalendarAction,
} from "@/app/ops/actions";
import { LocalDateTime } from "@/components/LocalDateTime";
import { getTenantOpsDetail } from "@/lib/tenancy/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isFutureEvent(startAt: string) {
  const startAtMs = new Date(startAt).getTime();
  return Number.isFinite(startAtMs) && startAtMs >= Date.now();
}

export default async function TenantEventsPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const detail = await getTenantOpsDetail(tenantId);
  if (!detail) {
    notFound();
  }

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

  return (
    <section className="console-section">
      <div className="console-section-header">
        <div>
          <h2>Ticket eligibility controls</h2>
          <p className="subtle-text">
            Public checkout only exposes tickets that pass automatic checks and all operator assertions.
            Only future mirrored events are shown here.
          </p>
          <p className="subtle-text">
            Importing from Luma still refreshes the full calendar connection. New upstream
            events appear below for review first, but tickets do not become public until they
            pass the existing eligibility and assertion checks.
          </p>
        </div>
      </div>

      {eventGroups.length === 0 ? (
        <div className="console-detail-card">
          <h3>No future events</h3>
          <p className="subtle-text">
            Ticket assertions only appear for mirrored events whose start time is still in
            the future.
          </p>
        </div>
      ) : null}

      {eventGroups.map(({ calendar, events, upstreamEvents, upstreamError }) => (
        <section className="console-content" key={calendar.calendar_connection_id}>
          <div className="console-section-header">
            <div>
              <h3>{calendar.display_name}</h3>
              <p className="subtle-text">
                Use the import action to refresh the full calendar and bring newly visible
                upstream events into the mirrored inventory.
              </p>
            </div>
            <form action={validateAndSyncCalendarAction}>
              <input
                name="calendar_connection_id"
                type="hidden"
                value={calendar.calendar_connection_id}
              />
              <input name="redirect_to" type="hidden" value={`/ops/tenants/${tenantId}/events`} />
              <button className="button button-secondary button-small" type="submit">
                {upstreamEvents.length ? "Import from Luma" : "Refresh from Luma"}
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
                    These future events are visible to the saved Luma key, but they are not yet
                    part of the mirrored checkout surface.
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
                          <span className="console-mini-pill">Upstream only</span>
                          <span className="console-mini-pill">Not mirrored yet</span>
                        </div>
                      </div>
                      <p className="subtle-text">
                        <LocalDateTime iso={event.start_at} />
                        {event.location_label ? ` · ${event.location_label}` : ""}
                      </p>
                      <p className="subtle-text">
                        Importing refreshes the full calendar. Ticket eligibility and operator
                        assertions still apply before public checkout is enabled.
                      </p>
                      {event.url ? (
                        <div className="button-row">
                          <a
                            className="button button-secondary button-small"
                            href={event.url}
                            rel="noreferrer noopener"
                            target="_blank"
                          >
                            Open on Luma
                          </a>
                        </div>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {events.map((event) => (
            <article className="console-detail-card console-event-review-card" key={event.event_api_id}>
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
                      <p className="console-kpi-label">{calendar.display_name}</p>
                      <h3>{event.name}</h3>
                    </div>
                    <div className="console-mini-pill-row">
                      <span className="console-mini-pill">
                        {event.zcash_enabled ? "Public checkout enabled" : "Public checkout hidden"}
                      </span>
                      <span className="console-mini-pill">
                        Sync {event.sync_status}
                      </span>
                    </div>
                  </div>
                  <p className="subtle-text">
                    <LocalDateTime iso={event.start_at} />
                    {event.location_label ? ` · ${event.location_label}` : ""}
                  </p>
                  <p className="subtle-text">
                    {event.zcash_enabled_reason || "No reason recorded"}
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
                    <Link
                      className="button button-secondary button-small"
                      href={`/c/${calendar.slug}/events/${encodeURIComponent(event.event_api_id)}`}
                    >
                      Open public event
                    </Link>
                  </div>
                </div>
              </div>

              <div className="console-signal-grid">
                <div className="console-signal-card">
                  <span className="console-kpi-label">Tickets</span>
                  <strong>
                    {(detail.tickets_by_event.get(event.event_api_id) || []).length} mirrored
                  </strong>
                  <p className="subtle-text">
                    {(
                      detail.tickets_by_event.get(event.event_api_id) || []
                    ).filter((ticket) => ticket.zcash_enabled).length} enabled for public checkout
                  </p>
                </div>
                <div className="console-signal-card">
                  <span className="console-kpi-label">Last sync</span>
                  <strong>{event.last_synced_at ? "Updated" : "Pending"}</strong>
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
                {(detail.tickets_by_event.get(event.event_api_id) || []).map((ticket) => (
                  <form action={setTicketAssertionsAction} className="console-detail-card console-ticket-assertion-card" key={ticket.ticket_type_api_id}>
                    <input name="event_api_id" type="hidden" value={ticket.event_api_id} />
                    <input name="ticket_type_api_id" type="hidden" value={ticket.ticket_type_api_id} />
                    <input name="redirect_to" type="hidden" value={`/ops/tenants/${tenantId}/events`} />
                    <div className="console-preview-body-head">
                      <div>
                        <p className="console-kpi-label">
                          {ticket.active ? "Active in Luma" : "Inactive in Luma"}
                        </p>
                        <h4>{ticket.name}</h4>
                      </div>
                      <div className="console-mini-pill-row">
                        <span className="console-mini-pill">
                          {ticket.zcash_enabled ? "Enabled" : "Hidden"}
                        </span>
                        <span className="console-mini-pill">
                          {ticketSummaryLabel(ticket)}
                        </span>
                      </div>
                    </div>
                    <p className="subtle-text">
                      Auto checks: {ticket.automatic_eligibility_status} · {ticket.automatic_eligibility_reasons.join(" ")}
                    </p>
                    <label className="console-field">
                      <span>
                        <input defaultChecked={ticket.confirmed_fixed_price} name="confirmed_fixed_price" type="checkbox" />
                        {" "}Confirm fixed price
                      </span>
                    </label>
                    <label className="console-field">
                      <span>
                        <input defaultChecked={ticket.confirmed_no_approval_required} name="confirmed_no_approval_required" type="checkbox" />
                        {" "}No approval required
                      </span>
                    </label>
                    <label className="console-field">
                      <span>
                        <input defaultChecked={ticket.confirmed_no_extra_required_questions} name="confirmed_no_extra_required_questions" type="checkbox" />
                        {" "}No extra required questions
                      </span>
                    </label>
                    <p className="subtle-text">
                      Public status: {ticket.zcash_enabled ? "enabled" : "disabled"} · {ticket.zcash_enabled_reason}
                    </p>
                    <button className="button button-secondary button-small" type="submit">
                      Save assertions
                    </button>
                  </form>
                ))}
              </div>
            </article>
          ))}
        </section>
      ))}
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
