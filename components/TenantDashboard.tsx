import Link from "next/link";
import { LocalDateTime } from "@/components/LocalDateTime";
import { ConsoleStatusPill } from "@/components/ConsoleStatusPill";
import { appUrl } from "@/lib/app-paths";
import { formatFiatAmount } from "@/lib/app-state/utils";
import { createSessionViewerToken } from "@/lib/session-viewer";
import type { TenantOpsDetail } from "@/lib/tenancy/service";

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="console-kpi-card">
      <p className="console-kpi-label">{label}</p>
      <p className="console-kpi-value">{value}</p>
      <p className="subtle-text console-kpi-detail">{detail}</p>
    </article>
  );
}

function registrationStatusClassName(status: string) {
  if (status === "registered") return "console-valid-text";
  if (status === "failed") return "console-error-text";
  return "subtle-text";
}

function isFutureEvent(startAt: string) {
  const startAtMs = new Date(startAt).getTime();
  return Number.isFinite(startAtMs) && startAtMs >= Date.now();
}

export function TenantDashboard({
  detail,
  tenantBasePath,
}: {
  detail: TenantOpsDetail;
  tenantBasePath: string;
}) {
  const webhookUrl = appUrl("/api/cipherpay/webhook");
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
    (delivery) => !delivery.signature_valid,
  ).length;
  const upcomingEvents = detail.events.flatMap(({ calendar, events }) =>
    events
      .filter((event) => isFutureEvent(event.start_at))
      .map((event) => ({
        calendar,
        event,
        tickets: detail.tickets_by_event.get(event.event_api_id) || [],
      })),
  );
  const activeCalendars = detail.calendars.filter(
    (calendar) => calendar.status === "active",
  ).length;

  return (
    <div className="console-page-body">
      <section className="console-section">
        <div className="console-section-header">
          <div>
            <p className="eyebrow">Internal dashboard</p>
            <h2>{detail.tenant.name}</h2>
            <p className="subtle-text">
              Service-manager view of tenant setup, upcoming mirrored inventory, recent
              checkout activity, and webhook health. This page is designed so we can reuse
              it later for organizer auth.
            </p>
          </div>
          <div className="button-row">
            <Link className="button button-secondary button-small" href={tenantBasePath}>
              Tenant settings
            </Link>
            <Link
              className="button button-secondary button-small"
              href={`${tenantBasePath}/events`}
            >
              Ticket controls
            </Link>
          </div>
        </div>

        <div className="console-kpi-grid">
          <StatCard
            label="Calendars"
            value={String(activeCalendars)}
            detail={`${detail.calendars.length} total, ${detail.tenant.status} tenant`}
          />
          <StatCard
            label="Upcoming events"
            value={String(upcomingEvents.length)}
            detail="Future mirrored inventory shown below"
          />
          <StatCard
            label="Tracked sessions"
            value={String(trackedSessions)}
            detail={`${pendingSessions} awaiting payment or registration`}
          />
          <StatCard
            label="Registered"
            value={String(registeredSessions)}
            detail={`${invalidWebhooks} invalid webhook deliveries recorded`}
          />
        </div>
      </section>

      <section className="console-section">
        <div className="console-section-header">
          <div>
            <h2>Setup</h2>
            <p className="subtle-text">
              Public entry points and the payment callback this tenant should use.
            </p>
          </div>
        </div>

        <div className="console-card-grid">
          <article className="console-detail-card">
            <h3>CipherPay webhook callback</h3>
            <p className="console-inline-code">
              {webhookUrl || "/api/cipherpay/webhook"}
            </p>
            <p className="subtle-text">
              All tenant accounts post to the same callback URL. The app resolves the
              correct tenant secret from the invoice id.
            </p>
          </article>

          <article className="console-detail-card">
            <h3>Commercial terms</h3>
            <p className="subtle-text">
              Service fee {detail.tenant.service_fee_bps} bps
            </p>
            <p className="subtle-text">
              Monthly minimum {detail.tenant.monthly_minimum_usd_cents} cents
            </p>
            <p className="subtle-text">
              Contact {detail.tenant.contact_email}
            </p>
          </article>
        </div>

        <div className="console-card-grid">
          {detail.calendars.map((calendar) => {
            const publicCalendarUrl = appUrl(`/c/${calendar.slug}`);
            const activeConnection =
              detail.active_cipherpay_connections_by_calendar.get(
                calendar.calendar_connection_id,
              ) || null;

            return (
              <article className="console-detail-card" key={calendar.calendar_connection_id}>
                <p className="console-kpi-label">{calendar.status}</p>
                <h3>{calendar.display_name}</h3>
                <p className="subtle-text">
                  Public URL:{" "}
                  {publicCalendarUrl ? (
                    <a href={publicCalendarUrl}>{publicCalendarUrl}</a>
                  ) : (
                    `/c/${calendar.slug}`
                  )}
                </p>
                <p className="subtle-text">
                  Luma sync {calendar.last_synced_at || "not yet"}{" "}
                  {calendar.last_sync_error ? `· ${calendar.last_sync_error}` : ""}
                </p>
                <p className="subtle-text">
                  CipherPay{" "}
                  {activeConnection
                    ? `${activeConnection.network} · ${activeConnection.status}`
                    : "not connected"}
                </p>
                {publicCalendarUrl ? (
                  <Link className="button button-secondary button-small" href={publicCalendarUrl}>
                    Open public calendar
                  </Link>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      <section className="console-section">
        <div className="console-section-header">
          <div>
            <h2>Upcoming mirrored events</h2>
            <p className="subtle-text">
              Future events only, with quick visibility into whether managed Zcash checkout is enabled.
            </p>
          </div>
        </div>

        {!upcomingEvents.length ? (
          <p className="subtle-text">No future mirrored events are available yet.</p>
        ) : (
          <div className="console-card-grid">
            {upcomingEvents.map(({ calendar, event, tickets }) => {
              const enabledTicketCount = tickets.filter((ticket) => ticket.zcash_enabled).length;
              const publicEventUrl = appUrl(
                `/c/${calendar.slug}/events/${encodeURIComponent(event.event_api_id)}`,
              );

              return (
                <article className="console-detail-card" key={event.event_api_id}>
                  <p className="console-kpi-label">{calendar.display_name}</p>
                  <h3>{event.name}</h3>
                  <p className="subtle-text">
                    <LocalDateTime iso={event.start_at} />
                  </p>
                  <p className="subtle-text">
                    Public checkout {event.zcash_enabled ? "enabled" : "hidden"} ·{" "}
                    {enabledTicketCount}/{tickets.length} tickets enabled
                  </p>
                  <p className="subtle-text">
                    {event.zcash_enabled_reason || "No reason recorded"}
                  </p>
                  <div className="button-row">
                    {publicEventUrl ? (
                      <Link className="button button-secondary button-small" href={publicEventUrl}>
                        Open event
                      </Link>
                    ) : null}
                    <Link
                      className="button button-secondary button-small"
                      href={`${tenantBasePath}/events`}
                    >
                      Ticket controls
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
              Latest tenant-scoped checkout sessions created through public event pages.
            </p>
          </div>
        </div>

        {!detail.sessions.length ? (
          <p className="subtle-text">No tenant checkout sessions yet.</p>
        ) : (
          <div className="console-table-wrap">
            <table className="console-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Attendee</th>
                  <th>Payment</th>
                  <th>Registration</th>
                  <th>Amount</th>
                  <th>Updated</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {detail.sessions.slice(0, 20).map((session) => {
                  const viewerToken = createSessionViewerToken(
                    session.session_id,
                    session.attendee_email,
                  );

                  return (
                    <tr key={session.session_id}>
                      <td>
                        <strong>{session.event_name}</strong>
                        <p className="subtle-text console-table-note">
                          {session.ticket_type_name || "No ticket label"}
                        </p>
                      </td>
                      <td>
                        <strong>{session.attendee_name}</strong>
                        <p className="subtle-text console-table-note">
                          {session.attendee_email}
                        </p>
                      </td>
                      <td>
                        <ConsoleStatusPill status={session.status} />
                      </td>
                      <td>
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
                      </td>
                      <td>{formatFiatAmount(session.amount, session.currency)}</td>
                      <td>
                        {session.updated_at ? (
                          <LocalDateTime iso={session.updated_at} />
                        ) : (
                          "n/a"
                        )}
                      </td>
                      <td>
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="console-section">
        <div className="console-section-header">
          <div>
            <h2>Webhook log</h2>
            <p className="subtle-text">
              Latest tenant-scoped deliveries from CipherPay and Luma, including signature results.
            </p>
          </div>
        </div>

        {!detail.webhooks.length ? (
          <p className="subtle-text">No webhook deliveries recorded yet.</p>
        ) : (
          <div className="console-table-wrap">
            <table className="console-table">
              <thead>
                <tr>
                  <th>Received</th>
                  <th>Provider</th>
                  <th>Event</th>
                  <th>Invoice</th>
                  <th>Signature</th>
                  <th>Apply</th>
                </tr>
              </thead>
              <tbody>
                {detail.webhooks.slice(0, 20).map((delivery) => (
                  <tr key={delivery.webhook_delivery_id}>
                    <td>
                      <LocalDateTime iso={delivery.received_at} />
                    </td>
                    <td>{delivery.provider}</td>
                    <td>
                      <strong>{delivery.event_type || "unknown"}</strong>
                      {delivery.event_api_id ? (
                        <p className="subtle-text console-table-note">
                          Event {delivery.event_api_id}
                        </p>
                      ) : null}
                    </td>
                    <td className="console-mono-cell">
                      {delivery.cipherpay_invoice_id || "n/a"}
                    </td>
                    <td>
                      <span
                        className={
                          delivery.signature_valid
                            ? "console-valid-text"
                            : "console-error-text"
                        }
                      >
                        {delivery.signature_valid ? "valid" : "invalid"}
                      </span>
                      {delivery.validation_error ? (
                        <p className="subtle-text console-table-note">
                          {delivery.validation_error}
                        </p>
                      ) : null}
                    </td>
                    <td>{delivery.apply_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
