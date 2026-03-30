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
import { formatFiatAmount } from "@/lib/app-state/utils";
import type { TenantOpsDetail } from "@/lib/tenancy/service";
import {
  buildWorkspaceOverview,
  calendarConnectionHealthLabel,
  recentSessionsForDashboard,
  summarizeCalendarInventory,
} from "@/lib/tenant-self-serve";

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
  const recentSessions = recentSessionsForDashboard(detail.sessions);

  return (
    <div className="console-page-body">
      <section className="console-section tenant-overview-hero">
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
