import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createCalendarConnectionAction,
  createCipherPayConnectionAction,
  disableCalendarConnectionAction,
  updateCalendarConnectionLumaKeyAction,
  validateAndSyncCalendarAction,
  validateCipherPayConnectionAction,
} from "@/app/dashboard/actions";
import { ConsoleDisclosure } from "@/components/ConsoleDisclosure";
import { ConsoleFieldLabel } from "@/components/ConsoleFieldLabel";
import { ConsoleInfoTip } from "@/components/ConsoleInfoTip";
import { LocalDateTime } from "@/components/LocalDateTime";
import type { CalendarConnection } from "@/lib/app-state/types";
import { requireTenantPageAccess } from "@/lib/tenant-auth-server";
import { getTenantSelfServeDetailBySlug } from "@/lib/tenancy/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isFutureEvent(startAt: string) {
  const startAtMs = new Date(startAt).getTime();
  return Number.isFinite(startAtMs) && startAtMs >= Date.now();
}

function summarizeCalendarInventory(
  detail: Awaited<ReturnType<typeof getTenantSelfServeDetailBySlug>>,
  calendar: CalendarConnection,
) {
  const mirroredEvents =
    detail?.events.find(
      (entry) => entry.calendar.calendar_connection_id === calendar.calendar_connection_id,
    )?.events || [];
  const mirroredByEventId = new Map(
    mirroredEvents.map((event) => [event.event_api_id, event] as const),
  );
  const futureMirroredEvents = mirroredEvents.filter((event) => isFutureEvent(event.start_at));
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

function calendarConnectionHealthLabel(calendar: CalendarConnection, hasSavedKey: boolean) {
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

export default async function TenantSettingsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const email = await requireTenantPageAccess();
  const { tenantSlug } = await params;
  const detail = await getTenantSelfServeDetailBySlug(tenantSlug, email);
  if (!detail) {
    notFound();
  }

  const settingsBasePath = `/dashboard/${encodeURIComponent(detail.tenant.slug)}/settings`;
  const eventsBasePath = `/dashboard/${encodeURIComponent(detail.tenant.slug)}/events`;

  const calendarNamesById = new Map(
    detail.calendars.map((calendar) => [
      calendar.calendar_connection_id,
      calendar.display_name,
    ]),
  );
  const cipherPayConnectionRows = detail.cipherpay_connections.map((connection) => {
    const previews = detail.cipherpay_secret_previews.get(connection.cipherpay_connection_id);
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
            <h2>Settings</h2>
            <p className="subtle-text">
              Connect your Luma calendar, keep the managed webhook healthy, and attach one
              live CipherPay account per calendar for checkout.
            </p>
          </div>
        </div>

        <div className="console-card-grid">
          <article className="console-detail-card">
            <h3>Primary contact</h3>
            <p className="subtle-text">{detail.tenant.contact_email}</p>
          </article>
          <article className="console-detail-card">
            <h3>Public dashboard links</h3>
            <div className="button-row">
              <Link className="button button-secondary button-small" href={`/dashboard/${detail.tenant.slug}`}>
                Overview
              </Link>
              <Link className="button button-secondary button-small" href={eventsBasePath}>
                Events and tickets
              </Link>
            </div>
          </article>
        </div>
      </section>

      <section className="console-section">
        <div className="console-section-header">
          <div>
            <h2>Luma calendar setup</h2>
            <p className="subtle-text">
              Connect one or more Luma calendars for your organization. Validation registers the
              managed event webhook and refreshes mirrored inventory for that calendar.
            </p>
          </div>
        </div>

        <ConsoleDisclosure
          defaultOpen={!detail.calendars.length}
          description="Save the Luma API key first. Connect and sync will verify access, register the managed event webhook, and refresh mirrored inventory for that calendar."
          title="Add calendar connection"
        >
          <form action={createCalendarConnectionAction} className="console-content">
            <input name="tenant_slug" type="hidden" value={detail.tenant.slug} />
            <input name="redirect_to" type="hidden" value={settingsBasePath} />
            <div className="public-field-grid">
              <label className="console-field">
                <ConsoleFieldLabel
                  info="Shown in your dashboard and used as the default public label for this calendar."
                  label="Display name"
                />
                <input className="console-input" name="display_name" required type="text" />
              </label>
              <label className="console-field">
                <ConsoleFieldLabel
                  info="Public URL path under /c/{slug}. Leave blank to generate it from the display name and add a numeric suffix if needed."
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
              detail.upstream_luma_events_by_calendar.get(calendar.calendar_connection_id) || null;
            const {
              mirroredByEventId,
              futureMirroredEvents,
              tickets,
              enabledEvents,
              enabledTickets,
            } = summarizeCalendarInventory(detail, calendar);
            const previewEvents = livePreview?.events.filter((event) => isFutureEvent(event.start_at));
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
                  : "Connect and sync";
            const liveOnlyCount = nextLiveEvents.filter(
              (event) => !mirroredByEventId.has(event.api_id),
            ).length;
            const webhookState =
              calendar.status === "disabled"
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
                      <input name="tenant_slug" type="hidden" value={detail.tenant.slug} />
                      <input name="redirect_to" type="hidden" value={settingsBasePath} />
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
                    <Link className="button button-secondary button-small" href={eventsBasePath}>
                      View mirrored events
                    </Link>
                    {calendar.status !== "disabled" ? (
                      <form action={disableCalendarConnectionAction}>
                        <input
                          name="calendar_connection_id"
                          type="hidden"
                          value={calendar.calendar_connection_id}
                        />
                        <input name="tenant_slug" type="hidden" value={detail.tenant.slug} />
                        <input name="redirect_to" type="hidden" value={settingsBasePath} />
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
                        "Connect and sync to confirm the saved key can read this calendar."
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
                        "Run sync to verify the key and mirror the calendar."
                      )}
                    </p>
                  </div>
                </div>

                {calendar.last_sync_error ? (
                  <p className="console-error-text">{calendar.last_sync_error}</p>
                ) : null}

                <div className="console-inline-action">
                  <p className="subtle-text">
                    Live Luma preview: {liveEventCount} event
                    {liveEventCount === 1 ? "" : "s"} available from the saved key.
                  </p>
                  <ConsoleInfoTip label="What Connect and sync does">
                    <p>
                      Checks that the saved Luma API key can read the calendar,
                      creates or refreshes the managed webhook for{" "}
                      <code>event.created</code>, <code>event.updated</code>, and{" "}
                      <code>event.canceled</code>, then refreshes the mirrored events and
                      tickets used by public checkout.
                    </p>
                  </ConsoleInfoTip>
                </div>

                <ConsoleDisclosure
                  defaultOpen={false}
                  description="Replace the saved Luma API key for this calendar connection."
                  title="Replace Luma API key"
                >
                  <form action={updateCalendarConnectionLumaKeyAction} className="console-content">
                    <input
                      name="calendar_connection_id"
                      type="hidden"
                      value={calendar.calendar_connection_id}
                    />
                    <input name="tenant_slug" type="hidden" value={detail.tenant.slug} />
                    <input name="redirect_to" type="hidden" value={settingsBasePath} />
                    <label className="console-field">
                      <ConsoleFieldLabel
                        info="Saving a new key clears the current webhook details until you run Connect and sync again."
                        label="New Luma API key"
                      />
                      <input className="console-input" name="luma_api_key" required type="password" />
                    </label>
                    <button className="button button-secondary button-small" type="submit">
                      Save new Luma API key
                    </button>
                  </form>
                </ConsoleDisclosure>
              </article>
            );
          })}
        </div>
      </section>

      <section className="console-section">
        <div className="console-section-header">
          <div>
            <h2>CipherPay setup</h2>
            <p className="subtle-text">
              Each calendar uses one live CipherPay account for checkout. Saving this form
              for a calendar replaces that calendar&apos;s current live checkout connection
              instead of adding another active one.
            </p>
          </div>
        </div>

        <ConsoleDisclosure
          defaultOpen={detail.calendars.length > 0 && !detail.cipherpay_connections.length}
          description="Leave the base URLs blank unless your organization uses custom CipherPay endpoints."
          title="CipherPay setup"
        >
          <form action={createCipherPayConnectionAction} className="console-content">
            <input name="tenant_slug" type="hidden" value={detail.tenant.slug} />
            <input name="redirect_to" type="hidden" value={settingsBasePath} />
            <div className="public-field-grid">
              <label className="console-field">
                <ConsoleFieldLabel
                  info="Choose which mirrored calendar this payment account should serve."
                  label="Calendar connection"
                />
                <select className="console-input" name="calendar_connection_id" required>
                  <option value="">Select calendar</option>
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
                <input
                  className="console-input"
                  name="cipherpay_webhook_secret"
                  required
                  type="password"
                />
              </label>
            </div>
            <button className="button" type="submit">
              Save CipherPay connection
            </button>
          </form>
        </ConsoleDisclosure>

        <div className="console-card-grid">
          {currentCipherPayConnections.map(({ calendarName, connection, previews }) => (
            <article className="console-detail-card" key={connection.cipherpay_connection_id}>
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
                <input name="tenant_slug" type="hidden" value={detail.tenant.slug} />
                <input name="redirect_to" type="hidden" value={settingsBasePath} />
                <button className="button button-secondary button-small" type="submit">
                  Mark validated
                </button>
              </form>
            </article>
          ))}
        </div>

        {historicalCipherPayConnections.length ? (
          <ConsoleDisclosure
            description="Older saved settings are kept for rollback and support reference, but they are not used for checkout."
            title="Previous saved settings"
          >
            <div className="console-card-grid">
              {historicalCipherPayConnections.map(({ calendarName, connection, previews }) => (
                <article className="console-detail-card" key={connection.cipherpay_connection_id}>
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
                    This row is kept for reference only and is not attached to checkout.
                  </p>
                </article>
              ))}
            </div>
          </ConsoleDisclosure>
        ) : null}
      </section>
    </>
  );
}
