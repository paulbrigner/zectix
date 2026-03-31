import Link from "next/link";
import {
  createCalendarConnectionAction,
  disableCalendarConnectionAction,
  updateCalendarConnectionLumaKeyAction,
  validateAndSyncCalendarAction,
} from "@/app/dashboard/actions";
import { ConsoleConfirmDialog } from "@/components/ConsoleConfirmDialog";
import { ConsoleDisclosure } from "@/components/ConsoleDisclosure";
import { ConsoleFieldLabel } from "@/components/ConsoleFieldLabel";
import { ConsoleFormPendingNote } from "@/components/ConsoleFormPendingNote";
import { ConsoleInfoTip } from "@/components/ConsoleInfoTip";
import { LocalDateTime } from "@/components/LocalDateTime";
import { ConsoleSubmitButton } from "@/components/ConsoleSubmitButton";
import { selectUpcomingEvents } from "@/lib/embed";
import type { TenantOpsDetail } from "@/lib/tenancy/service";
import {
  calendarConnectionHealthLabel,
  summarizeCalendarInventory,
} from "@/lib/tenant-self-serve";

function withHash(path: string, hash: string) {
  return `${path}#${hash}`;
}

export function TenantConnectionsLumaTab({
  detail,
  eventsBasePath,
  lumaTabPath,
  onboardingIncomplete,
  setupTabPath,
}: {
  detail: TenantOpsDetail;
  eventsBasePath: string;
  lumaTabPath: string;
  onboardingIncomplete: boolean;
  setupTabPath: string;
}) {
  const setupReturnPath = withHash(setupTabPath, "setup-checklist");
  const lumaReturnPath = withHash(lumaTabPath, "luma-calendars");
  const createCalendarReturnPath = onboardingIncomplete
    ? setupReturnPath
    : withHash(lumaTabPath, "connect-luma-calendar");
  const calendarReturnPath = onboardingIncomplete ? setupReturnPath : lumaReturnPath;

  return (
    <div className="console-content">
      <section
        className="console-section console-anchor-target"
        id="luma-calendars"
      >
        <div className="console-section-header">
          <div>
            <h3>Luma calendars</h3>
            <p className="subtle-text">
              Add a calendar, validate it, and keep the managed webhook healthy.
              Mirroring and public inventory depend on this layer working
              cleanly.
            </p>
          </div>
        </div>

        <div className="console-anchor-target" id="connect-luma-calendar">
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
                value={createCalendarReturnPath}
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
              <div className="button-row">
                <ConsoleSubmitButton
                  className="button"
                  label="Save calendar connection"
                  pendingLabel="Saving calendar connection..."
                />
              </div>
              <ConsoleFormPendingNote pendingLabel="Saving this calendar connection..." />
            </form>
          </ConsoleDisclosure>
        </div>

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
                      <h4>{calendar.display_name}</h4>
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
                          value={calendarReturnPath}
                        />
                        <ConsoleSubmitButton
                          className={`button button-small${
                            calendar.last_validated_at
                              ? " button-secondary"
                              : " button-attention"
                          }`}
                          label={
                            calendar.last_validated_at
                              ? "Re-sync now"
                              : "Connect and sync"
                          }
                          pendingLabel={
                            calendar.last_validated_at
                              ? "Re-syncing..."
                              : "Connecting and syncing..."
                          }
                        />
                        <ConsoleFormPendingNote pendingLabel="Refreshing this calendar and its mirrored inventory..." />
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
                            value={calendarReturnPath}
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
                          : "Add CipherPay in the next tab to make public checkout payable."}
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

                  <ConsoleDisclosure
                    defaultOpen={false}
                    description="Preview the latest visible Luma events for this calendar."
                    title="Current Luma preview"
                  >
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
                  </ConsoleDisclosure>

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
                        value={calendarReturnPath}
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
                      <div className="button-row">
                        <ConsoleSubmitButton
                          className="button button-secondary button-small"
                          label="Save new Luma API key"
                          pendingLabel="Saving new Luma API key..."
                        />
                      </div>
                      <ConsoleFormPendingNote pendingLabel="Saving the new Luma API key..." />
                    </form>
                  </ConsoleDisclosure>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
