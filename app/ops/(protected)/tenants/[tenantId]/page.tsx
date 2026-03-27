import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createCalendarConnectionAction,
  createCipherPayConnectionAction,
  disableCalendarConnectionAction,
  setTenantStatusAction,
  validateAndSyncCalendarAction,
  validateCipherPayConnectionAction,
} from "@/app/ops/actions";
import { ConsoleDisclosure } from "@/components/ConsoleDisclosure";
import { ConsoleFieldLabel } from "@/components/ConsoleFieldLabel";
import { ConsoleInfoTip } from "@/components/ConsoleInfoTip";
import { LocalDateTime } from "@/components/LocalDateTime";
import type { CalendarConnection } from "@/lib/app-state/types";
import { getTenantOpsDetail } from "@/lib/tenancy/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isFutureEvent(startAt: string) {
  const startAtMs = new Date(startAt).getTime();
  return Number.isFinite(startAtMs) && startAtMs >= Date.now();
}

function summarizeCalendarInventory(
  detail: Awaited<ReturnType<typeof getTenantOpsDetail>>,
  calendar: CalendarConnection,
) {
  const mirroredEvents =
    detail?.events.find(
      (entry) => entry.calendar.calendar_connection_id === calendar.calendar_connection_id,
    )?.events || [];
  const mirroredByEventId = new Map(
    mirroredEvents.map((event) => [event.event_api_id, event] as const),
  );
  const futureMirroredEvents = mirroredEvents.filter((event) =>
    isFutureEvent(event.start_at),
  );
  const tickets = mirroredEvents.flatMap(
    (event) => detail?.tickets_by_event.get(event.event_api_id) || [],
  );

  return {
    mirroredEvents,
    mirroredByEventId,
    futureMirroredEvents,
    tickets,
    enabledEvents: mirroredEvents.filter((event) => event.zcash_enabled),
    enabledTickets: tickets.filter((ticket) => ticket.zcash_enabled),
  };
}

function calendarConnectionHealthLabel(
  calendar: CalendarConnection,
  hasSavedKey: boolean,
) {
  if (calendar.status === "disabled") {
    return "Disabled";
  }

  if (!hasSavedKey) {
    return "Not configured";
  }

  if (calendar.last_validated_at) {
    return "Connected";
  }

  return "Needs validation";
}

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const detail = await getTenantOpsDetail(tenantId);
  if (!detail) {
    notFound();
  }

  const calendarNamesById = new Map(
    detail.calendars.map((calendar) => [
      calendar.calendar_connection_id,
      calendar.display_name,
    ]),
  );
  const cipherPayConnectionRows = detail.cipherpay_connections.map((connection) => {
    const previews = detail.cipherpay_secret_previews.get(
      connection.cipherpay_connection_id,
    );
    const activeConnection = detail.active_cipherpay_connections_by_calendar.get(
      connection.calendar_connection_id,
    );
    return {
      connection,
      previews,
      isCurrentConnection:
        activeConnection?.cipherpay_connection_id === connection.cipherpay_connection_id,
      calendarName:
        calendarNamesById.get(connection.calendar_connection_id) || "Unknown calendar",
    };
  });
  const currentCipherPayConnections = cipherPayConnectionRows.filter(
    (entry) => entry.isCurrentConnection,
  );
  const historicalCipherPayConnections = cipherPayConnectionRows.filter(
    (entry) => !entry.isCurrentConnection,
  );

  return (
    <>
      <section className="console-section">
        <div className="console-section-header">
          <div>
            <p className="eyebrow">{detail.tenant.status}</p>
            <h2>{detail.tenant.name}</h2>
            <p className="subtle-text">
              {detail.tenant.contact_email} · {detail.tenant.service_fee_bps} bps service fee · minimum {detail.tenant.monthly_minimum_usd_cents} cents
            </p>
          </div>
          <div className="button-row">
            <Link className="button button-secondary button-small" href={`/ops/tenants/${encodeURIComponent(detail.tenant.tenant_id)}/dashboard`}>
              Dashboard
            </Link>
            <Link className="button button-secondary button-small" href={`/ops/tenants/${encodeURIComponent(detail.tenant.tenant_id)}/events`}>
              Ticket controls
            </Link>
            <Link className="button button-secondary button-small" href={`/ops/tenants/${encodeURIComponent(detail.tenant.tenant_id)}/recovery`}>
              Recovery
            </Link>
          </div>
        </div>

        <form action={setTenantStatusAction} className="console-content">
          <input name="tenant_id" type="hidden" value={detail.tenant.tenant_id} />
          <input name="redirect_to" type="hidden" value={`/ops/tenants/${detail.tenant.tenant_id}`} />
          <div className="public-field-grid">
            <label className="console-field">
              <ConsoleFieldLabel
                info="Only active tenants resolve public calendar pages."
                label="Tenant status"
              />
              <select
                className="console-input"
                defaultValue={detail.tenant.status}
                name="status"
              >
                <option value="draft">draft</option>
                <option value="active">active</option>
                <option value="suspended">suspended</option>
                <option value="archived">archived</option>
              </select>
            </label>
          </div>
          <p className="subtle-text">
            Public calendar pages only resolve for tenants whose status is <code>active</code>.
          </p>
          <button className="button button-secondary button-small" type="submit">
            Save tenant status
          </button>
        </form>
      </section>

      <section className="console-section">
        <div className="console-section-header">
          <div>
            <h2>Calendar connection</h2>
            <p className="subtle-text">
              Connect a Luma calendar for this tenant, add another calendar if
              needed, or update an existing connection below. The managed event
              webhook is created internally during validation.
            </p>
          </div>
        </div>

        <ConsoleDisclosure
          defaultOpen={!detail.calendars.length}
          description="Save the Luma API key first. Validate and sync will verify access, register the managed event webhook, and refresh mirrored inventory for that calendar."
          title="Add calendar connection"
        >
          <form action={createCalendarConnectionAction} className="console-content">
            <input name="tenant_id" type="hidden" value={detail.tenant.tenant_id} />
            <input name="redirect_to" type="hidden" value={`/ops/tenants/${detail.tenant.tenant_id}`} />
            <div className="public-field-grid">
              <label className="console-field">
                <ConsoleFieldLabel
                  info="Shown in ops and used as the default public label for this calendar."
                  label="Display name"
                />
                <input className="console-input" name="display_name" required type="text" />
              </label>
              <label className="console-field">
                <ConsoleFieldLabel
                  info="Public URL path under /c/{slug}. Leave blank to generate it from the display name and add a numeric suffix if that slug is already taken."
                  label="Public slug"
                  optional
                />
                <input className="console-input" name="slug" type="text" />
              </label>
              <label className="console-field">
                <ConsoleFieldLabel
                  info="Organizer-owned Luma API key used to mirror events, attach attendees after payment, and register the managed event webhook."
                  label="Luma API key"
                />
                <input className="console-input" name="luma_api_key" required type="password" />
              </label>
            </div>
            <button className="button" type="submit">
              Save calendar connection
            </button>
          </form>
        </ConsoleDisclosure>

        <div className="console-luma-card-stack">
          {detail.calendars.map((calendar) => {
            const previews = detail.calendar_secret_previews.get(calendar.calendar_connection_id);
            const livePreview =
              detail.upstream_luma_events_by_calendar.get(
                calendar.calendar_connection_id,
              ) || null;
            const {
              mirroredByEventId,
              futureMirroredEvents,
              tickets,
              enabledEvents,
              enabledTickets,
            } = summarizeCalendarInventory(detail, calendar);
            const previewEvents = livePreview?.events.filter((event) =>
              isFutureEvent(event.start_at),
            );
            const nextLiveEvents =
              previewEvents && previewEvents.length > 0
                ? previewEvents.slice(0, 4)
                : livePreview?.events.slice(0, 4) || [];
            const liveEventCount = livePreview?.events.length || 0;
            const ticketCount = tickets.length;
            const webhookConfigured =
              Boolean(calendar.luma_webhook_id) && Boolean(previews?.lumaWebhook.has_value);
            const publicCalendarHref = `/c/${calendar.slug}`;
            const connectionHealth = calendarConnectionHealthLabel(
              calendar,
              Boolean(previews?.luma.has_value),
            );
            const validateLabel =
              calendar.status === "disabled"
                ? "Re-enable and sync"
                : calendar.last_validated_at
                  ? "Re-sync now"
                  : "Validate and sync";
            const liveOnlyCount = nextLiveEvents.filter(
              (event) => !mirroredByEventId.has(event.api_id),
            ).length;
            const webhookState = calendar.status === "disabled"
              ? "Disabled"
              : webhookConfigured
                ? "Configured"
                : "Pending";

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
                      Public URL: <Link href={publicCalendarHref}>/c/{calendar.slug}</Link>
                    </p>
                  </div>
                  <div className="button-row">
                    <form action={validateAndSyncCalendarAction}>
                      <input
                        name="calendar_connection_id"
                        type="hidden"
                        value={calendar.calendar_connection_id}
                      />
                      <input
                        name="redirect_to"
                        type="hidden"
                        value={`/ops/tenants/${detail.tenant.tenant_id}`}
                      />
                      <button className="button button-secondary button-small" type="submit">
                        {validateLabel}
                      </button>
                    </form>
                    {calendar.status === "active" ? (
                      <Link
                        className="button button-secondary button-small"
                        href={publicCalendarHref}
                      >
                        Open public calendar
                      </Link>
                    ) : null}
                    <Link
                      className="button button-secondary button-small"
                      href={`/ops/tenants/${encodeURIComponent(detail.tenant.tenant_id)}/events`}
                    >
                      View mirrored events
                    </Link>
                    <Link
                      className="button button-secondary button-small"
                      href={`/ops/tenants/${encodeURIComponent(detail.tenant.tenant_id)}/recovery`}
                    >
                      Recovery
                    </Link>
                    {calendar.status !== "disabled" ? (
                      <form action={disableCalendarConnectionAction}>
                        <input
                          name="calendar_connection_id"
                          type="hidden"
                          value={calendar.calendar_connection_id}
                        />
                        <input
                          name="redirect_to"
                          type="hidden"
                          value={`/ops/tenants/${detail.tenant.tenant_id}`}
                        />
                        <button className="button button-secondary button-small" type="submit">
                          Disable calendar
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>

                <div className="console-signal-grid">
                  <div className="console-signal-card">
                    <span className="console-kpi-label">Luma connection</span>
                    <strong>{connectionHealth}</strong>
                    <p className="subtle-text">
                      {previews?.luma.preview || "No secret saved yet"}
                    </p>
                  </div>
                  <div className="console-signal-card">
                    <span className="console-kpi-label">Last validated</span>
                    <strong>
                      {calendar.last_validated_at ? "Confirmed" : "Not yet validated"}
                    </strong>
                    <p className="subtle-text">
                      {calendar.last_validated_at ? (
                        <LocalDateTime iso={calendar.last_validated_at} />
                      ) : (
                        "Validate and sync to confirm the saved key can read this calendar."
                      )}
                    </p>
                  </div>
                  <div className="console-signal-card">
                    <span className="console-kpi-label">Managed webhook</span>
                    <strong>{webhookState}</strong>
                    <p className="subtle-text">
                      {calendar.status === "disabled"
                        ? "Removed from managed intake until the calendar is re-enabled."
                        : calendar.luma_webhook_id || "Created during validation"}
                    </p>
                  </div>
                  <div className="console-signal-card">
                    <span className="console-kpi-label">Mirrored inventory</span>
                    <strong>
                      {futureMirroredEvents.length} future events · {ticketCount} tickets
                    </strong>
                    <p className="subtle-text">
                      {enabledEvents.length} events and {enabledTickets.length} tickets are
                      currently Zcash-enabled · {liveOnlyCount} still only visible in Luma
                    </p>
                  </div>
                  <div className="console-signal-card">
                    <span className="console-kpi-label">Last sync</span>
                    <strong>{calendar.last_synced_at ? "Completed" : "Not yet synced"}</strong>
                    <p className="subtle-text">
                      {calendar.last_synced_at ? (
                        <LocalDateTime iso={calendar.last_synced_at} />
                      ) : (
                        "Run validation to verify the key and mirror the calendar."
                      )}
                    </p>
                  </div>
                </div>

                {calendar.last_sync_error ? (
                  <p className="console-error-text">{calendar.last_sync_error}</p>
                ) : null}

                {calendar.status === "disabled" ? (
                  <p className="subtle-text">
                    This calendar is disabled. Public checkout is off for this calendar until you
                    run <code>Re-enable and sync</code>.
                  </p>
                ) : null}

                <div className="console-inline-action">
                  <p className="subtle-text">
                    Live Luma preview: {liveEventCount} event
                    {liveEventCount === 1 ? "" : "s"} available from the saved key.
                  </p>
                  <ConsoleInfoTip label="What Validate and sync does">
                    <p>
                      Checks that the saved Luma API key can read the calendar,
                      creates or refreshes the managed webhook for{" "}
                      <code>event.created</code>, <code>event.updated</code>, and{" "}
                      <code>event.canceled</code>, then refreshes the mirrored
                      events and tickets used by public checkout.
                    </p>
                  </ConsoleInfoTip>
                </div>

                {livePreview?.error ? (
                  <div className="console-preview-empty">
                    <strong>Could not load current Luma events</strong>
                    <p className="subtle-text">{livePreview.error}</p>
                  </div>
                ) : nextLiveEvents.length ? (
                  <div className="console-preview-list">
                    {nextLiveEvents.map((event) => {
                      const mirroredEvent = mirroredByEventId.get(event.api_id) || null;
                      const mirroredTickets =
                        detail.tickets_by_event.get(event.api_id) || [];
                      const publicEventHref = mirroredEvent
                        ? `/c/${calendar.slug}/events/${encodeURIComponent(event.api_id)}`
                        : null;

                      return (
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
                                <p className="console-kpi-label">
                                  {mirroredEvent ? "Mirrored event" : "Live in Luma"}
                                </p>
                                <h4>{event.name}</h4>
                              </div>
                              <div className="console-mini-pill-row">
                                <span className="console-mini-pill">
                                  {mirroredEvent ? "Mirrored" : "Not mirrored yet"}
                                </span>
                                <span className="console-mini-pill">
                                  {mirroredEvent?.zcash_enabled
                                    ? "Public checkout enabled"
                                    : "Public checkout hidden"}
                                </span>
                              </div>
                            </div>
                            <p className="subtle-text">
                              <LocalDateTime iso={event.start_at} />
                              {event.location_label ? ` · ${event.location_label}` : ""}
                            </p>
                            <p className="subtle-text">
                              {mirroredTickets.length} mirrored ticket
                              {mirroredTickets.length === 1 ? "" : "s"} ·{" "}
                              {mirroredTickets.filter((ticket) => ticket.zcash_enabled).length}{" "}
                              enabled
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
                                <Link
                                  className="button button-secondary button-small"
                                  href={publicEventHref}
                                >
                                  Open public event
                                </Link>
                              ) : null}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="console-preview-empty">
                    <strong>No live Luma events to review yet</strong>
                    <p className="subtle-text">
                      Once this key can read upcoming Luma events, they will appear here before
                      and after each sync.
                    </p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="console-section">
        <div className="console-section-header">
          <div>
            <h2>CipherPay connection</h2>
            <p className="subtle-text">
              Each calendar uses one live CipherPay account for checkout.
              Saving this form for a calendar replaces that calendar’s current
              live checkout connection instead of adding another active one.
            </p>
          </div>
        </div>

        <ConsoleDisclosure
          defaultOpen={detail.calendars.length > 0 && !detail.cipherpay_connections.length}
          description="Leave the base URLs blank unless this tenant uses custom CipherPay endpoints."
          title="CipherPay setup"
        >
          <form action={createCipherPayConnectionAction} className="console-content">
            <input name="tenant_id" type="hidden" value={detail.tenant.tenant_id} />
            <input name="redirect_to" type="hidden" value={`/ops/tenants/${detail.tenant.tenant_id}`} />
            <div className="public-field-grid">
              <label className="console-field">
                <ConsoleFieldLabel
                  info="Choose which mirrored calendar this payment account should serve."
                  label="Calendar connection"
                />
                <select className="console-input" name="calendar_connection_id" required>
                  <option value="">Select calendar</option>
                  {detail.calendars.map((calendar) => (
                    <option key={calendar.calendar_connection_id} value={calendar.calendar_connection_id}>
                      {calendar.display_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="console-field">
                <ConsoleFieldLabel
                  info="Use testnet for staging and mainnet for real payments."
                  label="Network"
                />
                <select className="console-input" name="network" required>
                  <option value="testnet">testnet</option>
                  <option value="mainnet">mainnet</option>
                </select>
              </label>
              <label className="console-field">
                <ConsoleFieldLabel
                  info="Override only for a custom CipherPay deployment. Leave blank to use the default for the selected network."
                  label="API base URL"
                  optional
                />
                <input className="console-input" name="api_base_url" type="text" />
              </label>
              <label className="console-field">
                <ConsoleFieldLabel
                  info="Override only for a custom CipherPay checkout host. Leave blank to use the default for the selected network."
                  label="Checkout base URL"
                  optional
                />
                <input className="console-input" name="checkout_base_url" type="text" />
              </label>
              <label className="console-field">
                <ConsoleFieldLabel
                  info="Organizer-owned CipherPay API key used to create invoices."
                  label="CipherPay API key"
                />
                <input className="console-input" name="cipherpay_api_key" required type="password" />
              </label>
              <label className="console-field">
                <ConsoleFieldLabel
                  info="Webhook secret configured in CipherPay for /api/cipherpay/webhook."
                  label="CipherPay webhook secret"
                />
                <input className="console-input" name="cipherpay_webhook_secret" required type="password" />
              </label>
            </div>
            <button className="button" type="submit">
              Save CipherPay connection
            </button>
          </form>
        </ConsoleDisclosure>

        <div className="console-card-grid">
          {currentCipherPayConnections.map(
            ({ calendarName, connection, previews }) => (
              <article
                className="console-detail-card"
                key={connection.cipherpay_connection_id}
              >
                <p className="console-kpi-label">Current checkout connection</p>
                <h3>{connection.network}</h3>
                <p className="subtle-text">
                  {calendarName} · validation {connection.status}
                </p>
                <p className="subtle-text">{connection.api_base_url}</p>
                <p className="subtle-text">
                  API {previews?.api.preview || "missing"} · webhook{" "}
                  {previews?.webhook.preview || "missing"}
                </p>
                <form action={validateCipherPayConnectionAction}>
                  <input
                    name="cipherpay_connection_id"
                    type="hidden"
                    value={connection.cipherpay_connection_id}
                  />
                  <input
                    name="redirect_to"
                    type="hidden"
                    value={`/ops/tenants/${detail.tenant.tenant_id}`}
                  />
                  <button className="button button-secondary button-small" type="submit">
                    Mark validated
                  </button>
                </form>
              </article>
            ),
          )}
        </div>

        {historicalCipherPayConnections.length ? (
          <ConsoleDisclosure
            description="Older saved settings are kept for rollback and support reference, but they are not used for checkout."
            title="Previous saved settings"
          >
            <div className="console-card-grid">
              {historicalCipherPayConnections.map(
                ({ calendarName, connection, previews }) => (
                  <article
                    className="console-detail-card"
                    key={connection.cipherpay_connection_id}
                  >
                    <p className="console-kpi-label">Previous saved settings</p>
                    <h3>{connection.network}</h3>
                    <p className="subtle-text">
                      {calendarName} · last known validation {connection.status}
                    </p>
                    <p className="subtle-text">{connection.api_base_url}</p>
                    <p className="subtle-text">
                      API {previews?.api.preview || "missing"} · webhook{" "}
                      {previews?.webhook.preview || "missing"}
                    </p>
                    <p className="subtle-text">
                      This row is kept for reference only and is not attached to
                      checkout.
                    </p>
                  </article>
                ),
              )}
            </div>
          </ConsoleDisclosure>
        ) : null}
      </section>
    </>
  );
}
