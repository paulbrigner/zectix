import Link from "next/link";
import {
  ConsoleTable,
  ConsoleTableBody,
  ConsoleTableCell,
  ConsoleTableHead,
  ConsoleTableHeader,
  ConsoleTableRow,
} from "@/components/ConsoleTable";
import { LocalDateTime } from "@/components/LocalDateTime";
import { ConsoleStatusPill } from "@/components/ConsoleStatusPill";
import { createSessionViewerToken } from "@/lib/session-viewer";
import { formatFiatAmount, formatZecAmount } from "@/lib/app-state/utils";
import type { TenantOpsDetail } from "@/lib/tenancy/service";
import {
  buildWorkspaceOverview,
  calendarConnectionHealthLabel,
  recentSessionsForDashboard,
  summarizeCalendarInventory,
} from "@/lib/tenant-self-serve";

function overviewDestination(label: string) {
  switch (label) {
    case "Connect at least one Luma calendar":
    case "Validate and sync Luma":
    case "Attach a CipherPay account":
    case "Validate CipherPay":
    case "Activate public checkout":
      return "connections" as const;
    default:
      return "connections" as const;
  }
}

function registrationStatusClassName(status: string) {
  if (status === "registered") return "console-valid-text";
  if (status === "failed") return "console-error-text";
  return "subtle-text";
}

export function TenantOverviewWorkspace({
  detail,
  tenantBasePath,
}: {
  detail: TenantOpsDetail;
  tenantBasePath: string;
}) {
  const summary = buildWorkspaceOverview(detail);
  const currentOutstanding =
    detail.billing?.current_cycle?.outstanding_zatoshis || 0;
  const nextStepHref = `${tenantBasePath}/${overviewDestination(summary.nextStep?.label || "")}`;
  const recentSessions = recentSessionsForDashboard(detail.sessions);

  return (
    <div className="console-page-body">
      <section className="console-section tenant-overview-hero">
        <div className="tenant-overview-grid">
          <article className="console-detail-card tenant-overview-card tenant-overview-card-accent">
            <p className="console-kpi-label">Next step</p>
            <h3>{summary.nextStep?.label || "Workspace ready"}</h3>
            <p className="subtle-text">
              {summary.nextStep?.description ||
                "Your organizer workspace is configured and public checkout is live."}
            </p>
            <div className="tenant-overview-actions">
              <Link
                className="button button-secondary button-small"
                href={nextStepHref}
              >
                Continue setup
              </Link>
            </div>
          </article>

          <article className="console-detail-card tenant-overview-card">
            <p className="console-kpi-label">Billing</p>
            <h3>{detail.tenant.billing_status}</h3>
            <p className="subtle-text">
              Outstanding {formatZecAmount(currentOutstanding)} at{" "}
              {detail.tenant.service_fee_bps} bps.
            </p>
            <div className="tenant-overview-actions">
              <Link
                className="button button-secondary button-small"
                href={`${tenantBasePath}/billing`}
              >
                Open billing
              </Link>
            </div>
          </article>

          <article className="console-detail-card tenant-overview-card">
            <p className="console-kpi-label">Public checkout</p>
            <h3>
              {summary.liveEvents.length} live event
              {summary.liveEvents.length === 1 ? "" : "s"}
            </h3>
            <p className="subtle-text">
              {summary.ticketsNeedingReview} ticket
              {summary.ticketsNeedingReview === 1 ? "" : "s"} still need
              organizer review.
            </p>
            <div className="tenant-overview-actions">
              <Link
                className="button button-secondary button-small"
                href={`${tenantBasePath}/events`}
              >
                Review events
              </Link>
              <Link
                className="button button-secondary button-small"
                href={`${tenantBasePath}/embed`}
              >
                Embed setup
              </Link>
            </div>
          </article>
        </div>

        <div className="console-kpi-grid tenant-overview-metrics">
          <article className="console-kpi-card">
            <p className="console-kpi-label">Active calendars</p>
            <p className="console-kpi-value">{summary.activeCalendars}</p>
            <p className="subtle-text console-kpi-detail">
              {detail.calendars.length} total calendar connection
              {detail.calendars.length === 1 ? "" : "s"}
            </p>
          </article>
          <article className="console-kpi-card">
            <p className="console-kpi-label">Upcoming events</p>
            <p className="console-kpi-value">{summary.upcomingEvents.length}</p>
            <p className="subtle-text console-kpi-detail">
              {summary.liveEvents.length} currently visible on public checkout
            </p>
          </article>
          <article className="console-kpi-card">
            <p className="console-kpi-label">Pending checkouts</p>
            <p className="console-kpi-value">{summary.pendingSessions}</p>
            <p className="subtle-text console-kpi-detail">
              {summary.trackedSessions} total tracked sessions
            </p>
          </article>
          <article className="console-kpi-card">
            <p className="console-kpi-label">Registered</p>
            <p className="console-kpi-value">{summary.registeredSessions}</p>
            <p className="subtle-text console-kpi-detail">
              {summary.invalidWebhooks} invalid webhook{" "}
              {summary.invalidWebhooks === 1 ? "delivery" : "deliveries"}{" "}
              recorded
            </p>
          </article>
        </div>
      </section>

      <section className="console-section">
        <div className="console-section-header">
          <div>
            <h2>Connections at a glance</h2>
            <p className="subtle-text">
              A compact read on whether each calendar is mirrored, payable, and
              ready to embed.
            </p>
          </div>
          <div className="button-row">
            <Link
              className="button button-secondary button-small"
              href={`${tenantBasePath}/connections`}
            >
              Manage connections
            </Link>
            <Link
              className="button button-secondary button-small"
              href={`${tenantBasePath}/embed`}
            >
              Manage embed
            </Link>
          </div>
        </div>

        {!detail.calendars.length ? (
          <div className="console-preview-empty">
            <strong>No calendar connections yet</strong>
            <p className="subtle-text">
              Add your first Luma calendar on the Connections page to start
              mirroring events.
            </p>
          </div>
        ) : (
          <div className="console-card-grid">
            {detail.calendars.map((calendar) => {
              const previews = detail.calendar_secret_previews.get(
                calendar.calendar_connection_id,
              );
              const activeConnection =
                detail.active_cipherpay_connections_by_calendar.get(
                  calendar.calendar_connection_id,
                ) || null;
              const inventory = summarizeCalendarInventory(detail, calendar);
              const connectionHealth = calendarConnectionHealthLabel(
                calendar,
                Boolean(previews?.luma.has_value),
              );

              return (
                <article
                  className="console-detail-card tenant-summary-card"
                  key={calendar.calendar_connection_id}
                >
                  <div className="tenant-summary-card-head">
                    <div>
                      <p className="console-kpi-label">
                        {calendar.display_name}
                      </p>
                      <h3>{connectionHealth}</h3>
                    </div>
                    <div className="console-mini-pill-row">
                      <span className="console-mini-pill">
                        {calendar.status}
                      </span>
                      <span
                        className={`console-mini-pill${calendar.embed_enabled ? " console-mini-pill-info" : ""}`}
                      >
                        {calendar.embed_enabled ? "Embed on" : "Embed off"}
                      </span>
                    </div>
                  </div>

                  <dl className="tenant-summary-list">
                    <div>
                      <dt>Luma</dt>
                      <dd>{previews?.luma.preview || "No key saved yet"}</dd>
                    </div>
                    <div>
                      <dt>CipherPay</dt>
                      <dd>
                        {activeConnection
                          ? `${activeConnection.network} · ${activeConnection.status}`
                          : "Not connected"}
                      </dd>
                    </div>
                    <div>
                      <dt>Inventory</dt>
                      <dd>
                        {inventory.futureMirroredEvents.length} future event
                        {inventory.futureMirroredEvents.length === 1
                          ? ""
                          : "s"}{" "}
                        · {inventory.enabledEvents.length} live
                      </dd>
                    </div>
                  </dl>

                  <div className="button-row">
                    <Link
                      className="button button-secondary button-small"
                      href={`${tenantBasePath}/events`}
                    >
                      Review events
                    </Link>
                    <Link
                      className="button button-secondary button-small"
                      href={`${tenantBasePath}/connections`}
                    >
                      Edit connection
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="console-section">
        <div className="console-section-header">
          <div>
            <h2>Upcoming events</h2>
            <p className="subtle-text">
              Your next few mirrored events, with a quick read on what is
              already public.
            </p>
          </div>
          <Link
            className="button button-secondary button-small"
            href={`${tenantBasePath}/events`}
          >
            Open full event workspace
          </Link>
        </div>

        {!summary.upcomingEvents.length ? (
          <div className="console-preview-empty">
            <strong>No future mirrored events yet</strong>
            <p className="subtle-text">
              Once your calendar syncs, future events will show up here
              automatically.
            </p>
          </div>
        ) : (
          <div className="console-card-grid tenant-upcoming-grid">
            {summary.upcomingEvents
              .slice(0, 4)
              .map(({ calendar, event, tickets }) => {
                const enabledTicketCount = tickets.filter(
                  (ticket) => ticket.zcash_enabled,
                ).length;
                const publicEventHref = event.zcash_enabled
                  ? `/c/${calendar.slug}/events/${encodeURIComponent(event.event_api_id)}`
                  : null;

                return (
                  <article
                    className="console-detail-card console-preview-card tenant-upcoming-card"
                    key={event.event_api_id}
                  >
                    {event.cover_url ? (
                      <div className="console-preview-media tenant-upcoming-media">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img alt={event.name} src={event.cover_url} />
                      </div>
                    ) : (
                      <div className="console-preview-media console-preview-media-fallback tenant-upcoming-media">
                        <span>{event.name.slice(0, 2).toUpperCase()}</span>
                      </div>
                    )}
                    <div className="console-preview-body tenant-upcoming-body">
                      <div className="tenant-upcoming-head">
                        <div>
                          <p className="console-kpi-label">
                            {calendar.display_name}
                          </p>
                          <h4>{event.name}</h4>
                        </div>
                        <div className="console-mini-pill-row tenant-upcoming-pills">
                          <span
                            className={`console-mini-pill ${event.zcash_enabled ? "console-mini-pill-success" : "console-mini-pill-muted"}`}
                          >
                            {event.zcash_enabled ? "Live" : "Hidden"}
                          </span>
                          <span className="console-mini-pill console-mini-pill-info">
                            {enabledTicketCount}/{tickets.length} tickets ready
                          </span>
                        </div>
                      </div>
                      <p className="subtle-text tenant-upcoming-date">
                        <LocalDateTime iso={event.start_at} />
                        {event.location_label
                          ? ` · ${event.location_label}`
                          : ""}
                      </p>
                      <p className="subtle-text tenant-upcoming-summary">
                        {event.zcash_enabled_reason ||
                          "Waiting on ticket or event review."}
                      </p>
                    </div>
                    <div className="button-row tenant-upcoming-actions">
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
                      <Link
                        className="button button-secondary button-small"
                        href={`${tenantBasePath}/events`}
                      >
                        Review in workspace
                      </Link>
                    </div>
                  </article>
                );
              })}
          </div>
        )}
      </section>

      <section className="console-section">
        <div className="console-section-header">
          <div>
            <h2>Recent checkouts</h2>
            <p className="subtle-text">
              The newest attendee sessions, so you can spot payment or
              registration issues quickly.
            </p>
          </div>
        </div>

        {!recentSessions.length ? (
          <div className="console-preview-empty">
            <strong>No checkout sessions yet</strong>
            <p className="subtle-text">
              Sessions will appear here after someone starts a public checkout.
            </p>
          </div>
        ) : (
          <ConsoleTable>
            <ConsoleTableHead>
              <ConsoleTableRow>
                <ConsoleTableHeader>Event</ConsoleTableHeader>
                <ConsoleTableHeader>Attendee</ConsoleTableHeader>
                <ConsoleTableHeader>Payment</ConsoleTableHeader>
                <ConsoleTableHeader>Registration</ConsoleTableHeader>
                <ConsoleTableHeader>Amount</ConsoleTableHeader>
                <ConsoleTableHeader>Updated</ConsoleTableHeader>
                <ConsoleTableHeader>Action</ConsoleTableHeader>
              </ConsoleTableRow>
            </ConsoleTableHead>
            <ConsoleTableBody>
              {recentSessions.map((session) => {
                const viewerToken = createSessionViewerToken(
                  session.session_id,
                  session.attendee_email,
                );

                return (
                  <ConsoleTableRow key={session.session_id}>
                    <ConsoleTableCell>
                      <strong>{session.event_name}</strong>
                      <p className="subtle-text console-table-note">
                        {session.ticket_type_name || "No ticket label"}
                      </p>
                    </ConsoleTableCell>
                    <ConsoleTableCell>
                      <strong>{session.attendee_name}</strong>
                      <p className="subtle-text console-table-note">
                        {session.attendee_email}
                      </p>
                    </ConsoleTableCell>
                    <ConsoleTableCell>
                      <ConsoleStatusPill status={session.status} />
                    </ConsoleTableCell>
                    <ConsoleTableCell>
                      <span
                        className={registrationStatusClassName(
                          session.registration_status,
                        )}
                      >
                        {session.registration_status}
                      </span>
                      {session.registration_error ? (
                        <p className="subtle-text console-table-note">
                          {session.registration_error}
                        </p>
                      ) : null}
                    </ConsoleTableCell>
                    <ConsoleTableCell>
                      {formatFiatAmount(session.amount, session.currency)}
                    </ConsoleTableCell>
                    <ConsoleTableCell>
                      {session.updated_at ? (
                        <LocalDateTime iso={session.updated_at} />
                      ) : (
                        "n/a"
                      )}
                    </ConsoleTableCell>
                    <ConsoleTableCell>
                      <Link
                        className="button button-secondary button-small"
                        href={
                          viewerToken
                            ? `/checkout/${encodeURIComponent(session.session_id)}?t=${encodeURIComponent(viewerToken)}`
                            : `/checkout/${encodeURIComponent(session.session_id)}`
                        }
                      >
                        Open
                      </Link>
                    </ConsoleTableCell>
                  </ConsoleTableRow>
                );
              })}
            </ConsoleTableBody>
          </ConsoleTable>
        )}
      </section>
    </div>
  );
}
