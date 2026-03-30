import Link from "next/link";
import { LocalDateTime } from "@/components/LocalDateTime";
import { ConsoleStatusPill } from "@/components/ConsoleStatusPill";
import { appUrl } from "@/lib/app-paths";
import { formatFiatAmount, formatZecAmount } from "@/lib/app-state/utils";
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

function usesCallbackTokenFallback(delivery: TenantOpsDetail["webhooks"][number]) {
  return (
    delivery.validation_error === "accepted_via_callback_token" &&
    delivery.apply_status !== "ignored"
  );
}

function summarizeCalendar(detail: TenantOpsDetail, calendarConnectionId: string) {
  const mirroredEvents =
    detail.events.find(
      (entry) => entry.calendar.calendar_connection_id === calendarConnectionId,
    )?.events || [];
  const tickets = mirroredEvents.flatMap(
    (event) => detail.tickets_by_event.get(event.event_api_id) || [],
  );

  return {
    mirroredEvents,
    tickets,
    futureMirroredEvents: mirroredEvents.filter((event) => isFutureEvent(event.start_at)),
    enabledEvents: mirroredEvents.filter((event) => event.zcash_enabled),
    enabledTickets: tickets.filter((ticket) => ticket.zcash_enabled),
  };
}

export function TenantDashboard({
  detail,
  tenantBasePath,
  audience = "ops",
}: {
  detail: TenantOpsDetail;
  tenantBasePath: string;
  audience?: "ops" | "tenant";
}) {
  const isTenantAudience = audience === "tenant";
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
    (delivery) => !delivery.signature_valid && !usesCallbackTokenFallback(delivery),
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
  const settingsHref = isTenantAudience ? `${tenantBasePath}/connections` : tenantBasePath;
  const eventsHref = `${tenantBasePath}/events`;
  const billingHref = isTenantAudience ? `${tenantBasePath}/billing` : "/ops/reports";

  return (
    <div className="console-page-body">
      <section className="console-section">
        <div className="console-section-header">
          <div>
            <p className="eyebrow">
              {isTenantAudience ? "Organizer dashboard" : "Internal dashboard"}
            </p>
            <h2>{detail.tenant.name}</h2>
            <p className="subtle-text">
              {isTenantAudience
                ? "Review setup, upcoming mirrored inventory, recent checkouts, and webhook health for your managed Zcash checkout."
                : "Service-manager view of organization setup, upcoming mirrored inventory, recent checkout activity, and webhook health. This page is designed so we can reuse it later for organizer auth."}
            </p>
          </div>
          <div className="button-row">
            <Link className="button button-secondary button-small" href={settingsHref}>
              {isTenantAudience ? "Connections" : "Organization settings"}
            </Link>
            <Link className="button button-secondary button-small" href={billingHref}>
              Billing
            </Link>
            <Link
              className="button button-secondary button-small"
              href={eventsHref}
            >
              {isTenantAudience ? "Events and tickets" : "Ticket controls"}
            </Link>
          </div>
        </div>

        <div className="console-kpi-grid">
          <StatCard
            label="Calendars"
            value={String(activeCalendars)}
            detail={`${detail.calendars.length} total, organization status ${detail.tenant.status}`}
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
              {isTenantAudience
                ? "Public entry points, connection health, and what the saved Luma key can currently see upstream."
                : "Public entry points, connection health, and what the saved Luma key can currently see upstream."}
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
              All organizer accounts post to the same callback URL. The app resolves the
              correct secret from the invoice id.
            </p>
          </article>

          {isTenantAudience ? (
            <article className="console-detail-card">
              <h3>Billing</h3>
              <p className="subtle-text">
                Status {detail.tenant.billing_status} · fee {detail.tenant.service_fee_bps} bps
              </p>
              <p className="subtle-text">
                Current outstanding {formatZecAmount(detail.billing?.current_cycle?.outstanding_zatoshis || 0)}
              </p>
              <p className="subtle-text">
                Review cycle history, credits, and settlement notes from the billing tab.
              </p>
            </article>
          ) : (
            <article className="console-detail-card">
              <h3>Commercial terms</h3>
              <p className="subtle-text">
                Service fee {detail.tenant.service_fee_bps} bps
              </p>
              <p className="subtle-text">
                Billing {detail.tenant.billing_status} · grace {detail.tenant.billing_grace_days} days
              </p>
              <p className="subtle-text">
                Threshold {formatZecAmount(detail.tenant.settlement_threshold_zatoshis)} · contact {detail.tenant.contact_email}
              </p>
            </article>
          )}
        </div>

        <div className="console-luma-card-stack">
          {detail.calendars.map((calendar) => {
            const publicCalendarUrl = appUrl(`/c/${calendar.slug}`);
            const activeConnection =
              detail.active_cipherpay_connections_by_calendar.get(
                calendar.calendar_connection_id,
              ) || null;
            const calendarPreviews =
              detail.calendar_secret_previews.get(calendar.calendar_connection_id) || null;
            const livePreview =
              detail.upstream_luma_events_by_calendar.get(
                calendar.calendar_connection_id,
              ) || null;
            const {
              futureMirroredEvents,
              tickets,
              enabledEvents,
              enabledTickets,
            } = summarizeCalendar(detail, calendar.calendar_connection_id);
            const liveUpcomingEvents =
              livePreview?.events.filter((event) => isFutureEvent(event.start_at)).slice(0, 3) ||
              livePreview?.events.slice(0, 3) ||
              [];
            const webhookConfigured =
              Boolean(calendar.luma_webhook_id) &&
              Boolean(calendarPreviews?.lumaWebhook.has_value);

            return (
              <article
                className="console-detail-card console-luma-card"
                key={calendar.calendar_connection_id}
              >
                <div className="console-luma-card-head">
                  <div>
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
                  </div>
                  <div className="button-row">
                    <Link
                      className="button button-secondary button-small"
                      href={settingsHref}
                    >
                      {isTenantAudience ? "Settings" : "Settings"}
                    </Link>
                    <Link
                      className="button button-secondary button-small"
                      href={eventsHref}
                    >
                      {isTenantAudience ? "Events and tickets" : "Review tickets"}
                    </Link>
                  </div>
                </div>

                <div className="console-signal-grid">
                  <div className="console-signal-card">
                    <span className="console-kpi-label">Luma</span>
                    <strong>
                      {calendarPreviews?.luma.has_value ? "Key saved" : "Missing key"}
                    </strong>
                    <p className="subtle-text">
                      {webhookConfigured ? "Webhook configured" : "Webhook pending"}
                    </p>
                  </div>
                  <div className="console-signal-card">
                    <span className="console-kpi-label">Mirrored events</span>
                    <strong>{futureMirroredEvents.length} future</strong>
                    <p className="subtle-text">
                      {enabledEvents.length} public events enabled
                    </p>
                  </div>
                  <div className="console-signal-card">
                    <span className="console-kpi-label">Tickets</span>
                    <strong>{tickets.length} mirrored tickets</strong>
                    <p className="subtle-text">
                      {enabledTickets.length} currently Zcash-enabled
                    </p>
                  </div>
                  <div className="console-signal-card">
                    <span className="console-kpi-label">CipherPay</span>
                    <strong>
                      {activeConnection
                        ? `${activeConnection.network} ready`
                        : "Not connected"}
                    </strong>
                    <p className="subtle-text">
                      {activeConnection
                        ? `Validation ${activeConnection.status}`
                        : "Checkout is unavailable until a connection is added."}
                    </p>
                  </div>
                </div>

                {calendar.last_sync_error ? (
                  <p className="console-error-text">{calendar.last_sync_error}</p>
                ) : null}

                <div className="console-preview-list console-preview-list-compact">
                  {livePreview?.error ? (
                    <div className="console-preview-empty">
                      <strong>Could not load current Luma events</strong>
                      <p className="subtle-text">{livePreview.error}</p>
                    </div>
                  ) : liveUpcomingEvents.length ? (
                    liveUpcomingEvents.map((event) => (
                      <article className="console-preview-card console-preview-card-compact" key={event.api_id}>
                        <div className="console-preview-body">
                          <div className="console-preview-body-head">
                            <div>
                              <p className="console-kpi-label">Live Luma feed</p>
                              <h4>{event.name}</h4>
                            </div>
                          </div>
                          <p className="subtle-text">
                            <LocalDateTime iso={event.start_at} />
                            {event.location_label ? ` · ${event.location_label}` : ""}
                          </p>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="console-preview-empty">
                      <strong>No Luma events available yet</strong>
                      <p className="subtle-text">
                        Save and validate the Luma key to start mirroring this calendar.
                      </p>
                    </div>
                  )}
                </div>
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
          <div className="console-card-grid tenant-upcoming-grid">
            {upcomingEvents.map(({ calendar, event, tickets }) => {
              const enabledTicketCount = tickets.filter((ticket) => ticket.zcash_enabled).length;
              const publicEventUrl = event.zcash_enabled
                ? appUrl(`/c/${calendar.slug}/events/${encodeURIComponent(event.event_api_id)}`)
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
                        <p className="console-kpi-label">{calendar.display_name}</p>
                        <h4>{event.name}</h4>
                      </div>
                      <div className="console-mini-pill-row tenant-upcoming-pills">
                        <span
                          className={`console-mini-pill ${event.zcash_enabled ? "console-mini-pill-success" : "console-mini-pill-muted"}`}
                        >
                          {event.zcash_enabled ? "Public checkout enabled" : "Public checkout hidden"}
                        </span>
                        <span className="console-mini-pill console-mini-pill-info">
                          {enabledTicketCount}/{tickets.length} tickets enabled
                        </span>
                      </div>
                    </div>
                    <p className="subtle-text tenant-upcoming-date">
                      <LocalDateTime iso={event.start_at} />
                      {event.location_label ? ` · ${event.location_label}` : ""}
                    </p>
                    <p className="subtle-text tenant-upcoming-summary">
                      {event.zcash_enabled_reason || "No reason recorded"}
                    </p>
                  </div>
                  <div className="button-row tenant-upcoming-actions">
                    {publicEventUrl ? (
                      <Link className="button button-secondary button-small" href={publicEventUrl}>
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
                      href={eventsHref}
                    >
                      {isTenantAudience ? "Events and tickets" : "Ticket controls"}
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
              Latest checkout sessions created through public event pages for this organization.
            </p>
          </div>
        </div>

        {!detail.sessions.length ? (
          <p className="subtle-text">No checkout sessions yet.</p>
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
              {isTenantAudience
                ? "Latest deliveries from CipherPay and Luma for this organization, including authentication results."
                : "Latest deliveries from CipherPay and Luma for this organization, including request authentication results."}
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
                  <th>Auth</th>
                  <th>Apply</th>
                </tr>
              </thead>
              <tbody>
                {detail.webhooks.slice(0, 20).map((delivery) => {
                  const acceptedViaCallbackToken = usesCallbackTokenFallback(delivery);

                  return (
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
                      {acceptedViaCallbackToken ? (
                        <>
                          <span className="console-valid-text">callback token</span>
                          <p className="subtle-text console-table-note">
                            accepted via callback token
                          </p>
                        </>
                      ) : (
                        <span
                          className={
                            delivery.signature_valid
                              ? "console-valid-text"
                              : "console-error-text"
                          }
                        >
                          {delivery.signature_valid ? "valid" : "invalid"}
                        </span>
                      )}
                      {delivery.validation_error &&
                      !acceptedViaCallbackToken ? (
                        <p className="subtle-text console-table-note">
                          {delivery.validation_error}
                        </p>
                      ) : null}
                    </td>
                    <td>{delivery.apply_status}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
