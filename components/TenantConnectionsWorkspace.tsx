import Link from "next/link";
import {
  createCalendarConnectionAction,
  createCipherPayConnectionAction,
  disableCalendarConnectionAction,
  updateCalendarConnectionLumaKeyAction,
  validateAndSyncCalendarAction,
  validateCipherPayConnectionAction,
} from "@/app/dashboard/actions";
import { ConsoleConfirmDialog } from "@/components/ConsoleConfirmDialog";
import { ConsoleDisclosure } from "@/components/ConsoleDisclosure";
import { ConsoleFieldLabel } from "@/components/ConsoleFieldLabel";
import { ConsoleInfoTip } from "@/components/ConsoleInfoTip";
import { LocalDateTime } from "@/components/LocalDateTime";
import { selectUpcomingEvents } from "@/lib/embed";
import type { TenantOpsDetail } from "@/lib/tenancy/service";
import {
  buildOnboardingChecklist,
  calendarConnectionHealthLabel,
  summarizeCalendarInventory,
} from "@/lib/tenant-self-serve";

export function TenantConnectionsWorkspace({
  detail,
  tenantBasePath,
}: {
  detail: TenantOpsDetail;
  tenantBasePath: string;
}) {
  const connectionsBasePath = `${tenantBasePath}/connections`;
  const eventsBasePath = `${tenantBasePath}/events`;
  const embedBasePath = `${tenantBasePath}/embed`;
  const onboardingChecklist = buildOnboardingChecklist(detail);
  const completedSteps = onboardingChecklist.filter(
    (item) => item.complete,
  ).length;
  const calendarNamesById = new Map(
    detail.calendars.map((calendar) => [
      calendar.calendar_connection_id,
      calendar.display_name,
    ]),
  );
  const cipherPayConnectionRows = detail.cipherpay_connections.map(
    (connection) => {
      const previews = detail.cipherpay_secret_previews.get(
        connection.cipherpay_connection_id,
      );
      const activeConnection =
        detail.active_cipherpay_connections_by_calendar.get(
          connection.calendar_connection_id,
        );
      return {
        calendarName:
          calendarNamesById.get(connection.calendar_connection_id) ||
          "Unknown calendar",
        connection,
        isCurrentConnection:
          activeConnection?.cipherpay_connection_id ===
          connection.cipherpay_connection_id,
        previews,
      };
    },
  );
  const currentCipherPayConnections = cipherPayConnectionRows.filter(
    (entry) => entry.isCurrentConnection,
  );
  const historicalCipherPayConnections = cipherPayConnectionRows.filter(
    (entry) => !entry.isCurrentConnection,
  );

  return (
    <div className="console-page-body">
      <section className="console-section">
        <div className="console-section-header">
          <div>
            <h2>Connections</h2>
            <p className="subtle-text">
              Keep Luma and CipherPay healthy here. This page is focused on
              setup and connectivity, not day-to-day event review.
            </p>
          </div>
        </div>

        <div className="console-kpi-grid">
          <article className="console-kpi-card">
            <p className="console-kpi-label">Onboarding progress</p>
            <p className="console-kpi-value">
              {completedSteps}/{onboardingChecklist.length}
            </p>
            <p className="subtle-text console-kpi-detail">
              {detail.tenant.onboarding_status.replaceAll("_", " ")}
            </p>
          </article>
          <article className="console-kpi-card">
            <p className="console-kpi-label">Calendars</p>
            <p className="console-kpi-value">{detail.calendars.length}</p>
            <p className="subtle-text console-kpi-detail">
              {
                detail.calendars.filter(
                  (calendar) => calendar.last_validated_at,
                ).length
              }{" "}
              validated
            </p>
          </article>
          <article className="console-kpi-card">
            <p className="console-kpi-label">CipherPay</p>
            <p className="console-kpi-value">
              {currentCipherPayConnections.length}
            </p>
            <p className="subtle-text console-kpi-detail">
              live checkout connection
              {currentCipherPayConnections.length === 1 ? "" : "s"}
            </p>
          </article>
          <article className="console-kpi-card">
            <p className="console-kpi-label">Embed-ready calendars</p>
            <p className="console-kpi-value">
              {
                detail.calendars.filter(
                  (calendar) =>
                    calendar.embed_enabled &&
                    calendar.embed_allowed_origins.length > 0,
                ).length
              }
            </p>
            <p className="subtle-text console-kpi-detail">
              Continue in the Embed workspace once checkout is live
            </p>
          </article>
        </div>

        <ConsoleDisclosure
          className="tenant-checklist-card"
          description={`${completedSteps}/${onboardingChecklist.length} setup steps are complete. Open the checklist when you want the full sequence.`}
          title="Setup checklist"
        >
          <div className="console-section-header">
            <div>
              <h3>What still needs attention</h3>
            </div>
            <div className="button-row">
              <Link
                className="button button-secondary button-small"
                href={eventsBasePath}
              >
                Event workspace
              </Link>
              <Link
                className="button button-secondary button-small"
                href={embedBasePath}
              >
                Embed workspace
              </Link>
            </div>
          </div>

          <ol className="tenant-checklist">
            {onboardingChecklist.map((item, index) => (
              <li
                className={`tenant-checklist-item${item.complete ? " tenant-checklist-item-complete" : ""}`}
                key={item.label}
              >
                <div className="tenant-checklist-marker" aria-hidden="true">
                  {item.complete ? "✓" : String(index + 1)}
                </div>
                <div>
                  <strong>{item.label}</strong>
                  <p className="subtle-text">{item.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </ConsoleDisclosure>
      </section>

      <section className="console-section">
        <div className="console-section-header">
          <div>
            <h2>Luma calendars</h2>
            <p className="subtle-text">
              Add a calendar, validate it, and keep the managed webhook healthy.
              Mirroring and public inventory depend on this layer working
              cleanly.
            </p>
          </div>
        </div>

        <ConsoleDisclosure
          defaultOpen={!detail.calendars.length}
          description="Save the Luma API key first. Connect and sync will verify access, register the managed event webhook, and refresh mirrored inventory for that calendar."
          title="Add calendar connection"
        >
          <form
            action={createCalendarConnectionAction}
            className="console-content"
          >
            <input
              name="tenant_slug"
              type="hidden"
              value={detail.tenant.slug}
            />
            <input
              name="redirect_to"
              type="hidden"
              value={connectionsBasePath}
            />
            <div className="public-field-grid">
              <label className="console-field">
                <ConsoleFieldLabel
                  info="Shown in your dashboard and used as the default public label for this calendar."
                  label="Display name"
                />
                <input
                  className="console-input"
                  name="display_name"
                  required
                  type="text"
                />
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
                <input
                  className="console-input"
                  name="luma_api_key"
                  required
                  type="password"
                />
              </label>
            </div>
            <button className="button" type="submit">
              Save calendar connection
            </button>
          </form>
        </ConsoleDisclosure>

        {!detail.calendars.length ? (
          <div className="console-preview-empty">
            <strong>No calendars connected yet</strong>
            <p className="subtle-text">
              Add a calendar to begin mirroring events into your organizer
              workspace.
            </p>
          </div>
        ) : (
          <div className="console-luma-card-stack">
            {detail.calendars.map((calendar) => {
              const previews = detail.calendar_secret_previews.get(
                calendar.calendar_connection_id,
              );
              const livePreview =
                detail.upstream_luma_events_by_calendar.get(
                  calendar.calendar_connection_id,
                ) || null;
              const {
                futureMirroredEvents,
                mirroredByEventId,
                enabledEvents,
                enabledTickets,
                tickets,
              } = summarizeCalendarInventory(detail, calendar);
              const previewEvents = livePreview
                ? selectUpcomingEvents(livePreview.events)
                : [];
              const nextLiveEvents =
                previewEvents.length > 0
                  ? previewEvents.slice(0, 3)
                  : livePreview?.events.slice(0, 3) || [];
              const webhookConfigured =
                Boolean(calendar.luma_webhook_id) &&
                Boolean(previews?.lumaWebhook.has_value);
              const connectionHealth = calendarConnectionHealthLabel(
                calendar,
                Boolean(previews?.luma.has_value),
              );
              const activeConnection =
                detail.active_cipherpay_connections_by_calendar.get(
                  calendar.calendar_connection_id,
                ) || null;
              const liveOnlyCount = nextLiveEvents.filter(
                (event) => !mirroredByEventId.has(event.api_id),
              ).length;

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
                        <Link href={`/c/${calendar.slug}`}>
                          /c/{calendar.slug}
                        </Link>
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
                          name="tenant_slug"
                          type="hidden"
                          value={detail.tenant.slug}
                        />
                        <input
                          name="redirect_to"
                          type="hidden"
                          value={connectionsBasePath}
                        />
                        <button
                          className="button button-secondary button-small"
                          type="submit"
                        >
                          {calendar.last_validated_at
                            ? "Re-sync now"
                            : "Connect and sync"}
                        </button>
                      </form>
                      <Link
                        className="button button-secondary button-small"
                        href={eventsBasePath}
                      >
                        Review events
                      </Link>
                      {calendar.status !== "disabled" ? (
                        <ConsoleConfirmDialog
                          action={disableCalendarConnectionAction}
                          confirmLabel="Disable calendar"
                          description="This turns off public checkout for this calendar until you reconnect and validate it again."
                          title={`Disable ${calendar.display_name}?`}
                          triggerLabel="Disable calendar"
                        >
                          <input
                            name="calendar_connection_id"
                            type="hidden"
                            value={calendar.calendar_connection_id}
                          />
                          <input
                            name="tenant_slug"
                            type="hidden"
                            value={detail.tenant.slug}
                          />
                          <input
                            name="redirect_to"
                            type="hidden"
                            value={connectionsBasePath}
                          />
                        </ConsoleConfirmDialog>
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
                      <span className="console-kpi-label">Webhook</span>
                      <strong>
                        {webhookConfigured ? "Configured" : "Pending"}
                      </strong>
                      <p className="subtle-text">
                        {calendar.status === "disabled"
                          ? "Disabled until this calendar is re-enabled."
                          : calendar.luma_webhook_id ||
                            "Created during validation"}
                      </p>
                    </div>
                    <div className="console-signal-card">
                      <span className="console-kpi-label">
                        Mirrored inventory
                      </span>
                      <strong>
                        {futureMirroredEvents.length} future event
                        {futureMirroredEvents.length === 1 ? "" : "s"}
                      </strong>
                      <p className="subtle-text">
                        {enabledEvents.length} live · {enabledTickets.length}{" "}
                        ticket
                        {enabledTickets.length === 1 ? "" : "s"} enabled
                      </p>
                    </div>
                    <div className="console-signal-card">
                      <span className="console-kpi-label">Checkout</span>
                      <strong>
                        {activeConnection
                          ? `${activeConnection.network} ready`
                          : "Not connected"}
                      </strong>
                      <p className="subtle-text">
                        {activeConnection
                          ? `Validation ${activeConnection.status}`
                          : "Add CipherPay below to make public checkout payable."}
                      </p>
                    </div>
                  </div>

                  {calendar.last_sync_error ? (
                    <p className="console-error-text">
                      {calendar.last_sync_error}
                    </p>
                  ) : null}

                  <div className="console-inline-action">
                    <p className="subtle-text">
                      Last sync{" "}
                      {calendar.last_synced_at ? (
                        <LocalDateTime iso={calendar.last_synced_at} />
                      ) : (
                        "not run yet"
                      )}{" "}
                      · {tickets.length} mirrored ticket
                      {tickets.length === 1 ? "" : "s"} · {liveOnlyCount} live
                      Luma event{liveOnlyCount === 1 ? "" : "s"} not yet
                      mirrored
                    </p>
                    <ConsoleInfoTip label="What Connect and sync does">
                      <p>
                        Checks that the saved Luma key can read the calendar,
                        creates or refreshes the managed webhook, and refreshes
                        the mirrored events and tickets used by public checkout.
                      </p>
                    </ConsoleInfoTip>
                  </div>

                  <div className="console-preview-list console-preview-list-compact">
                    {livePreview?.error ? (
                      <div className="console-preview-empty">
                        <strong>Could not load the current Luma preview</strong>
                        <p className="subtle-text">{livePreview.error}</p>
                      </div>
                    ) : nextLiveEvents.length ? (
                      nextLiveEvents.map((event) => (
                        <article
                          className="console-preview-card console-preview-card-compact"
                          key={event.api_id}
                        >
                          <div className="console-preview-body">
                            <div className="console-preview-body-head">
                              <div>
                                <p className="console-kpi-label">
                                  Live Luma preview
                                </p>
                                <h4>{event.name}</h4>
                              </div>
                            </div>
                            <p className="subtle-text">
                              <LocalDateTime iso={event.start_at} />
                              {event.location_label
                                ? ` · ${event.location_label}`
                                : ""}
                            </p>
                          </div>
                        </article>
                      ))
                    ) : (
                      <div className="console-preview-empty">
                        <strong>No upstream events visible yet</strong>
                        <p className="subtle-text">
                          Save and validate the Luma key to preview current
                          events here.
                        </p>
                      </div>
                    )}
                  </div>

                  <ConsoleDisclosure
                    defaultOpen={false}
                    description="Replace the saved Luma API key for this calendar connection."
                    title="Replace Luma API key"
                  >
                    <form
                      action={updateCalendarConnectionLumaKeyAction}
                      className="console-content"
                    >
                      <input
                        name="calendar_connection_id"
                        type="hidden"
                        value={calendar.calendar_connection_id}
                      />
                      <input
                        name="tenant_slug"
                        type="hidden"
                        value={detail.tenant.slug}
                      />
                      <input
                        name="redirect_to"
                        type="hidden"
                        value={connectionsBasePath}
                      />
                      <label className="console-field">
                        <ConsoleFieldLabel
                          info="Saving a new key clears the current webhook details until you run Connect and sync again."
                          label="New Luma API key"
                        />
                        <input
                          className="console-input"
                          name="luma_api_key"
                          required
                          type="password"
                        />
                      </label>
                      <button
                        className="button button-secondary button-small"
                        type="submit"
                      >
                        Save new Luma API key
                      </button>
                    </form>
                  </ConsoleDisclosure>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="console-section">
        <div className="console-section-header">
          <div>
            <h2>CipherPay checkout</h2>
            <p className="subtle-text">
              Each calendar uses one live CipherPay account for checkout. Saving
              a new connection for a calendar replaces that calendar&apos;s
              current live checkout connection.
            </p>
          </div>
        </div>

        <ConsoleDisclosure
          defaultOpen={
            detail.calendars.length > 0 && !detail.cipherpay_connections.length
          }
          description="Leave the base URLs blank unless your organization uses custom CipherPay endpoints."
          title="Add or replace a checkout connection"
        >
          <form
            action={createCipherPayConnectionAction}
            className="console-content"
          >
            <input
              name="tenant_slug"
              type="hidden"
              value={detail.tenant.slug}
            />
            <input
              name="redirect_to"
              type="hidden"
              value={connectionsBasePath}
            />
            <div className="public-field-grid">
              <label className="console-field">
                <ConsoleFieldLabel
                  info="Choose which mirrored calendar this payment account should serve."
                  label="Calendar connection"
                />
                <select
                  className="console-input"
                  name="calendar_connection_id"
                  required
                >
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
                <input
                  className="console-input"
                  name="api_base_url"
                  type="text"
                />
              </label>
              <label className="console-field">
                <ConsoleFieldLabel
                  info="Override only for a custom CipherPay checkout host. Leave blank to use the default for the selected network."
                  label="Checkout base URL"
                  optional
                />
                <input
                  className="console-input"
                  name="checkout_base_url"
                  type="text"
                />
              </label>
              <label className="console-field">
                <ConsoleFieldLabel
                  info="Organizer-owned CipherPay API key used to create invoices."
                  label="CipherPay API key"
                />
                <input
                  className="console-input"
                  name="cipherpay_api_key"
                  required
                  type="password"
                />
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

        {!currentCipherPayConnections.length ? (
          <div className="console-preview-empty">
            <strong>No live checkout connection yet</strong>
            <p className="subtle-text">
              Add a CipherPay connection to make public checkout payable for one
              of your mirrored calendars.
            </p>
          </div>
        ) : (
          <div className="console-card-grid">
            {currentCipherPayConnections.map(
              ({ calendarName, connection, previews }) => (
                <article
                  className="console-detail-card"
                  key={connection.cipherpay_connection_id}
                >
                  <p className="console-kpi-label">
                    Current checkout connection
                  </p>
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
                      name="tenant_slug"
                      type="hidden"
                      value={detail.tenant.slug}
                    />
                    <input
                      name="redirect_to"
                      type="hidden"
                      value={connectionsBasePath}
                    />
                    <button
                      className="button button-secondary button-small"
                      type="submit"
                    >
                      Mark validated
                    </button>
                  </form>
                </article>
              ),
            )}
          </div>
        )}

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
    </div>
  );
}
