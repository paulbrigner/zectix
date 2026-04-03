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

function invalidWebhookSummary(invalidWebhooks: number) {
  if (invalidWebhooks <= 0) {
    return "No invalid webhook deliveries recorded.";
  }

  return `${invalidWebhooks} invalid webhook ${
    invalidWebhooks === 1 ? "delivery needs" : "deliveries need"
  } immediate review.`;
}

function calendarStatusPillClassName(status: string) {
  return status === "active"
    ? "console-mini-pill console-mini-pill-success"
    : "console-mini-pill";
}

function hostedCalendarHref(slug: string) {
  return `/c/${encodeURIComponent(slug)}`;
}

export function TenantOverviewWorkspace({
  detail,
}: {
  detail: TenantOpsDetail;
}) {
  const summary = buildWorkspaceOverview(detail);
  const recentSessions = recentSessionsForDashboard(detail.sessions);
  const singleCalendarOverview = detail.calendars.length === 1;
  const primaryCalendar = detail.calendars[0] || null;
  const primaryCalendarPreview = primaryCalendar
    ? detail.calendar_secret_previews.get(primaryCalendar.calendar_connection_id)
    : null;
  const primaryCalendarHealth = primaryCalendar
    ? calendarConnectionHealthLabel(
        primaryCalendar,
        Boolean(primaryCalendarPreview?.luma.has_value),
      )
    : "Not connected";

  const recentCheckoutsContent = !recentSessions.length ? (
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
  );

  return (
    <div className="console-page-body">
      <section className="console-section tenant-overview-hero">
        <div className="console-kpi-grid tenant-overview-metrics">
          <article className="console-kpi-card">
            <p className="console-kpi-label">Luma sync</p>
            <p className="console-kpi-value">{primaryCalendarHealth}</p>
            <p className="subtle-text console-kpi-detail">
              {primaryCalendar?.last_synced_at ? (
                <>
                  Last synced{" "}
                  <LocalDateTime iso={primaryCalendar.last_synced_at} />
                </>
              ) : primaryCalendar ? (
                "Run Connect and sync to refresh mirrored events."
              ) : (
                "Connect your Luma calendar to begin mirroring events."
              )}
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
              {invalidWebhookSummary(summary.invalidWebhooks)}
            </p>
          </article>
        </div>
      </section>

      <section className="console-section">
        {!detail.calendars.length ? (
          <div className="console-preview-empty">
            <strong>No calendar connections yet</strong>
            <p className="subtle-text">
              Add your first Luma calendar on the Connections page to start
              mirroring events.
            </p>
          </div>
        ) : detail.calendars.length === 1 ? (
          (() => {
            const calendar = detail.calendars[0];
            const connectionHealth = calendarConnectionHealthLabel(
              calendar,
              Boolean(
                detail.calendar_secret_previews.get(
                  calendar.calendar_connection_id,
                )?.luma.has_value,
              ),
            );

            return (
              <div className="tenant-summary-card">
                <div className="tenant-summary-card-head">
                  <div>
                    <p className="console-kpi-label">{calendar.display_name}</p>
                    <div className="tenant-summary-status-line">
                      <h3>{connectionHealth}</h3>
                      <Link
                        className="tenant-summary-public-link"
                        href={hostedCalendarHref(calendar.slug)}
                      >
                        /c/{calendar.slug}
                      </Link>
                    </div>
                  </div>
                  <div className="console-mini-pill-row">
                    <span className={calendarStatusPillClassName(calendar.status)}>
                      {calendar.status}
                    </span>
                    <span
                      className={`console-mini-pill${calendar.embed_enabled ? " console-mini-pill-info" : ""}`}
                    >
                      {calendar.embed_enabled ? "Embed on" : "Embed off"}
                    </span>
                  </div>
                </div>

                <div className="tenant-summary-checkouts">
                  <h4>Recent checkouts</h4>
                  {recentCheckoutsContent}
                </div>
              </div>
            );
          })()
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
                      <div className="tenant-summary-status-line">
                        <h3>{connectionHealth}</h3>
                        <Link
                          className="tenant-summary-public-link"
                          href={hostedCalendarHref(calendar.slug)}
                        >
                          /c/{calendar.slug}
                        </Link>
                      </div>
                    </div>
                    <div className="console-mini-pill-row">
                      <span className={calendarStatusPillClassName(calendar.status)}>
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
                </article>
              );
            })}
          </div>
        )}
      </section>

      {!singleCalendarOverview ? (
        <section className="console-section">
        <div className="console-section-header">
          <div>
            <h2>Recent checkouts</h2>
          </div>
        </div>
        {recentCheckoutsContent}
      </section>
      ) : null}
    </div>
  );
}
