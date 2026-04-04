import Link from "next/link";
import {
  createCalendarConnectionAction,
  disableCalendarConnectionAction,
  updateCalendarConnectionLumaKeyAction,
  validateAndSyncCalendarAction,
} from "@/app/dashboard/actions";
import { ConsoleConfirmDialog } from "@/components/ConsoleConfirmDialog";
import { ConsoleDisclosure } from "@/components/ConsoleDisclosure";
import { ConsoleFieldLabel, ConsoleFieldHint } from "@/components/ConsoleFieldLabel";
import { ConsoleForm } from "@/components/ConsoleForm";
import { ConsoleFormPendingNote } from "@/components/ConsoleFormPendingNote";
import { ConsoleSection } from "@/components/ConsoleSection";
import { ConsoleSubmitButton } from "@/components/ConsoleSubmitButton";
import { LocalDateTime } from "@/components/LocalDateTime";
import { selectUpcomingEvents } from "@/lib/embed";
import type { TenantOpsDetail } from "@/lib/tenancy/service";
import {
  calendarConnectionHealthLabel,
  summarizeCalendarInventory,
} from "@/lib/tenant-self-serve";

type SearchParamValue = string | string[] | undefined;

function withHash(path: string, hash: string) {
  return `${path}#${hash}`;
}

function readSearchValue(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

function CreateCalendarConnectionForm({
  detail,
  redirectTo,
}: {
  detail: TenantOpsDetail;
  redirectTo: string;
}) {
  return (
    <ConsoleForm action={createCalendarConnectionAction}>
      <input name="tenant_slug" type="hidden" value={detail.tenant.slug} />
      <input name="redirect_to" type="hidden" value={redirectTo} />
      <div className="public-field-grid">
        <label className="console-field">
          <ConsoleFieldLabel label="Display name" />
          <input
            className="console-input"
            name="display_name"
            required
            type="text"
          />
          <ConsoleFieldHint>
            Shown in your dashboard and used as the default public label for this calendar.
          </ConsoleFieldHint>
        </label>
        <label className="console-field">
          <ConsoleFieldLabel label="Luma API key" />
          <input
            className="console-input"
            name="luma_api_key"
            required
            type="password"
          />
          <ConsoleFieldHint>
            Organizer-owned Luma API key used to mirror events, attach attendees after payment, and register the managed event webhook.
          </ConsoleFieldHint>
        </label>
        <label className="console-field">
          <ConsoleFieldLabel label="Public slug" optional />
          <input className="console-input" name="slug" type="text" />
          <ConsoleFieldHint>
            Public URL path under /c/&#123;slug&#125;. Leave blank to generate it from the display name.
          </ConsoleFieldHint>
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
    </ConsoleForm>
  );
}

export function TenantConnectionsLumaTab({
  detail,
  eventsBasePath,
  lumaTabPath,
  onboardingIncomplete,
  searchParams,
  setupTabPath,
}: {
  detail: TenantOpsDetail;
  eventsBasePath: string;
  lumaTabPath: string;
  onboardingIncomplete: boolean;
  searchParams: Record<string, SearchParamValue>;
  setupTabPath: string;
}) {
  const setupReturnPath = withHash(setupTabPath, "setup-checklist");
  const lumaReturnPath = withHash(lumaTabPath, "luma-calendars");
  const createCalendarReturnPath = onboardingIncomplete
    ? setupReturnPath
    : withHash(lumaTabPath, "connect-luma-calendar");
  const calendarReturnPath = onboardingIncomplete
    ? setupReturnPath
    : lumaReturnPath;
  const singleCalendarMode = detail.calendars.length <= 1;
  const lumaAlreadyConnected =
    readSearchValue(searchParams.luma_error) === "already_connected";

  const calendarCards = detail.calendars.map((calendar) => {
    const previews = detail.calendar_secret_previews.get(
      calendar.calendar_connection_id,
    );
    const livePreview =
      detail.upstream_luma_events_by_calendar.get(
        calendar.calendar_connection_id,
      ) || null;
    const {
      futureMirroredEvents,
      enabledEvents,
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

    return (
      <article
        className="console-detail-card console-luma-card"
        key={calendar.calendar_connection_id}
      >
        <div className="console-luma-card-head">
          <div>
            <span className="console-connection-status">
              <span className={`console-connection-status-dot console-connection-status-dot-${calendar.status === "active" ? "active" : calendar.status === "disabled" ? "disabled" : "pending"}`} />
              {connectionHealth}
            </span>
            <h4>{calendar.display_name}</h4>
          </div>
          <div className="console-luma-card-actions">
            <span className="console-luma-sync-note">
              Last sync{" "}
              {calendar.last_synced_at ? (
                <LocalDateTime iso={calendar.last_synced_at} />
              ) : (
                "not run yet"
              )}
            </span>
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
                triggerClassName="console-danger-link"
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
            <strong>{webhookConfigured ? "Configured" : "Pending"}</strong>
            <p className="subtle-text">
              {calendar.status === "disabled"
                ? "Disabled until this calendar is re-enabled."
                : calendar.luma_webhook_id || "Created during validation"}
            </p>
          </div>
          <div className="console-signal-card">
            <span className="console-kpi-label">Mirrored inventory</span>
            <strong>
              {futureMirroredEvents.length} future event
              {futureMirroredEvents.length === 1 ? "" : "s"}
            </strong>
            <p className="subtle-text">{enabledEvents.length} live</p>
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
          <p className="console-error-text">{calendar.last_sync_error}</p>
        ) : null}

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
                        <p className="console-kpi-label">Live Luma preview</p>
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
                <strong>No upstream events visible yet</strong>
                <p className="subtle-text">
                  Save and validate the Luma key to preview current events here.
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
          <ConsoleForm action={updateCalendarConnectionLumaKeyAction}>
            <input
              name="calendar_connection_id"
              type="hidden"
              value={calendar.calendar_connection_id}
            />
            <input name="tenant_slug" type="hidden" value={detail.tenant.slug} />
            <input
              name="redirect_to"
              type="hidden"
              value={calendarReturnPath}
            />
            <label className="console-field">
              <ConsoleFieldLabel label="New Luma API key" />
              <input
                className="console-input"
                name="luma_api_key"
                required
                type="password"
              />
              <ConsoleFieldHint>
                Saving a new key clears the current webhook details until you run Connect and sync again.
              </ConsoleFieldHint>
            </label>
            <div className="button-row">
              <ConsoleSubmitButton
                className="button button-secondary button-small"
                label="Save new Luma API key"
                pendingLabel="Saving new Luma API key..."
              />
            </div>
            <ConsoleFormPendingNote pendingLabel="Saving the new Luma API key..." />
          </ConsoleForm>
        </ConsoleDisclosure>
      </article>
    );
  });

  if (singleCalendarMode) {
    return (
      <div className="console-content">
        {lumaAlreadyConnected ? (
          <ConsoleSection
            role="alert"
            title="A Luma calendar is already connected."
            titleAs="h3"
          >
            <p className="subtle-text">
              Tenant self-serve now supports one Luma calendar per organizer
              account. Replace the saved Luma API key instead of adding another
              calendar.
            </p>
          </ConsoleSection>
        ) : null}

        {!detail.calendars.length ? (
          <article
            className="console-detail-card console-luma-card console-anchor-target"
            id="connect-luma-calendar"
          >
            <div className="console-luma-card-head">
              <div>
                <h3>Connect your Luma calendar</h3>
                <p className="subtle-text">
                  Save the Luma API key first. Connect and sync will verify
                  access, register the managed event webhook, and refresh your
                  mirrored event inventory.
                </p>
              </div>
            </div>
            <CreateCalendarConnectionForm
              detail={detail}
              redirectTo={createCalendarReturnPath}
            />
          </article>
        ) : (
          <div
            className="console-luma-card-stack console-anchor-target"
            id="luma-calendars"
          >
            {calendarCards}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="console-content">
      <ConsoleSection
        className="console-anchor-target"
        id="luma-calendars"
        title="Luma calendars"
        titleAs="h3"
      >
        <div className="console-anchor-target" id="connect-luma-calendar">
          <ConsoleDisclosure
            defaultOpen={!detail.calendars.length}
            description="Save the Luma API key first. Connect and sync will verify access, register the managed event webhook, and refresh mirrored inventory for that calendar."
            title="Add calendar connection"
          >
            <CreateCalendarConnectionForm
              detail={detail}
              redirectTo={createCalendarReturnPath}
            />
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
          <div className="console-luma-card-stack">{calendarCards}</div>
        )}
      </ConsoleSection>
    </div>
  );
}
