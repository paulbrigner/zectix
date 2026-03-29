import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createCalendarConnectionAction,
  createCipherPayConnectionAction,
  disableCalendarConnectionAction,
  updateCalendarEmbedSettingsAction,
  updateCalendarConnectionLumaKeyAction,
  validateAndSyncCalendarAction,
  validateCipherPayConnectionAction,
} from "@/app/dashboard/actions";
import { ConsoleDisclosure } from "@/components/ConsoleDisclosure";
import { ConsoleFieldLabel } from "@/components/ConsoleFieldLabel";
import { ConsoleInfoTip } from "@/components/ConsoleInfoTip";
import { LocalDateTime } from "@/components/LocalDateTime";
import type { CalendarConnection } from "@/lib/app-state/types";
import { appUrl } from "@/lib/app-paths";
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

function humanizeOnboardingStatus(value: string) {
  return value.replaceAll("_", " ");
}

function buildOnboardingChecklist(
  detail: NonNullable<Awaited<ReturnType<typeof getTenantSelfServeDetailBySlug>>>,
) {
  const hasCalendar = detail.calendars.length > 0;
  const hasValidatedCalendar = detail.calendars.some(
    (calendar) => calendar.status === "active" && Boolean(calendar.last_validated_at),
  );
  const hasCipherPayConnection = detail.cipherpay_connections.length > 0;
  const hasValidatedCipherPay = detail.cipherpay_connections.some(
    (connection) => connection.status === "active",
  );

  return [
    {
      label: "Draft organizer created",
      complete: true,
      description: `Status ${detail.tenant.status} · onboarding ${humanizeOnboardingStatus(detail.tenant.onboarding_status)}`,
    },
    {
      label: "Connect at least one Luma calendar",
      complete: hasCalendar,
      description: hasCalendar
        ? `${detail.calendars.length} calendar connection${detail.calendars.length === 1 ? "" : "s"} configured`
        : "Add a calendar connection below to start mirroring inventory.",
    },
    {
      label: "Validate and sync Luma",
      complete: hasValidatedCalendar,
      description: hasValidatedCalendar
        ? "At least one calendar was validated and mirrored."
        : "Run Connect and sync once the Luma key is saved.",
    },
    {
      label: "Attach a CipherPay account",
      complete: hasCipherPayConnection,
      description: hasCipherPayConnection
        ? `${detail.cipherpay_connections.length} CipherPay configuration${detail.cipherpay_connections.length === 1 ? "" : "s"} saved`
        : "Save a CipherPay account for the calendar you want to use for checkout.",
    },
    {
      label: "Validate CipherPay",
      complete: hasValidatedCipherPay,
      description: hasValidatedCipherPay
        ? "At least one CipherPay configuration is marked active."
        : "Validate the current CipherPay connection after saving it.",
    },
    {
      label: "Activate the tenant for public checkout",
      complete: detail.tenant.status === "active",
      description:
        detail.tenant.status === "active"
          ? "Public calendar routes can resolve for active calendars."
          : "A draft tenant stays dark publicly until it is activated.",
    },
  ];
}

function buildEmbedEventUrl(calendarSlug: string, eventApiId: string) {
  const relativeUrl =
    `/c/${encodeURIComponent(calendarSlug)}` +
    `/events/${encodeURIComponent(eventApiId)}?embed=1`;
  return appUrl(relativeUrl) || relativeUrl;
}

function buildEmbedSnippet(url: string, title: string, height: number) {
  const safeTitle = title.replaceAll('"', "&quot;");
  return `<iframe src="${url}" title="${safeTitle}" style="width:100%;height:${height}px;border:0;" loading="lazy"></iframe>`;
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
  const onboardingChecklist = buildOnboardingChecklist(detail);

  return (
    <>
      <section className="console-section">
        <div className="console-section-header">
          <div>
            <h2>Settings</h2>
            <p className="subtle-text">
              Complete the setup checklist, keep the managed webhook healthy,
              and attach one live CipherPay account per calendar for checkout.
            </p>
          </div>
        </div>

        <div className="console-card-grid">
          <article className="console-detail-card">
            <h3>Primary contact</h3>
            <p className="subtle-text">{detail.tenant.contact_email}</p>
          </article>
          <article className="console-detail-card">
            <h3>Onboarding status</h3>
            <p className="console-kpi-label">{humanizeOnboardingStatus(detail.tenant.onboarding_status)}</p>
            <p className="subtle-text">
              Tenant status {detail.tenant.status}
              {detail.tenant.onboarding_started_at ? (
                <>
                  {" "}· started <LocalDateTime iso={detail.tenant.onboarding_started_at} />
                </>
              ) : null}
            </p>
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
            <h2>Onboarding checklist</h2>
            <p className="subtle-text">
              This tracks the draft-to-live path for self-service setup. Public
              checkout stays off until the tenant is activated.
            </p>
          </div>
        </div>

        <div className="console-card-grid">
          {onboardingChecklist.map((item) => (
            <article className="console-detail-card" key={item.label}>
              <p className="console-kpi-label">{item.complete ? "complete" : "next"}</p>
              <h3>{item.label}</h3>
              <p className="subtle-text">{item.description}</p>
            </article>
          ))}
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
            const embedExampleEvents = enabledEvents
              .filter((event) => isFutureEvent(event.start_at))
              .slice(0, 2);
            const embedReady =
              calendar.embed_enabled && calendar.embed_allowed_origins.length > 0;

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

                <ConsoleDisclosure
                  defaultOpen={false}
                  description="Allow this calendar's event pages to render inside an iframe on approved origins."
                  title="Embed checkout"
                >
                  <form action={updateCalendarEmbedSettingsAction} className="console-content">
                    <input
                      name="calendar_connection_id"
                      type="hidden"
                      value={calendar.calendar_connection_id}
                    />
                    <input name="tenant_slug" type="hidden" value={detail.tenant.slug} />
                    <input name="redirect_to" type="hidden" value={settingsBasePath} />

                    <div className="public-field-grid">
                      <label className="console-field">
                        <ConsoleFieldLabel
                          info="Turn on iframe rendering for this calendar's event checkout entry pages."
                          label="Enable embedding"
                        />
                        <input
                          defaultChecked={calendar.embed_enabled}
                          name="embed_enabled"
                          type="checkbox"
                        />
                      </label>
                      <label className="console-field">
                        <ConsoleFieldLabel
                          info="Recommended iframe height in pixels for generated snippets. Hosts can still override this."
                          label="Default iframe height"
                        />
                        <input
                          className="console-input"
                          defaultValue={calendar.embed_default_height_px}
                          min={480}
                          name="embed_default_height_px"
                          type="number"
                        />
                      </label>
                      <label className="console-field">
                        <ConsoleFieldLabel
                          info="Keep the compact ZecTix/Tenant branding header visible inside the iframe."
                          label="Show branding"
                        />
                        <input
                          defaultChecked={calendar.embed_show_branding}
                          name="embed_show_branding"
                          type="checkbox"
                        />
                      </label>
                    </div>

                    <label className="console-field">
                      <ConsoleFieldLabel
                        info="Enter one site origin per line, for example https://events.example.com. Only these origins can host the iframe."
                        label="Allowed origins"
                      />
                      <textarea
                        className="console-input"
                        defaultValue={calendar.embed_allowed_origins.join("\n")}
                        name="embed_allowed_origins"
                        rows={4}
                      />
                    </label>

                    <div className="public-field-grid">
                      <label className="console-field">
                        <ConsoleFieldLabel
                          info="Optional accent color override for embedded buttons and highlights."
                          label="Accent color"
                          optional
                        />
                        <input
                          className="console-input"
                          defaultValue={calendar.embed_theme.accent_color || ""}
                          name="embed_accent_color"
                          placeholder="#d4920a"
                          type="text"
                        />
                      </label>
                      <label className="console-field">
                        <ConsoleFieldLabel
                          info="Optional page background color for the embedded shell."
                          label="Background color"
                          optional
                        />
                        <input
                          className="console-input"
                          defaultValue={calendar.embed_theme.background_color || ""}
                          name="embed_background_color"
                          placeholder="#fafaf9"
                          type="text"
                        />
                      </label>
                      <label className="console-field">
                        <ConsoleFieldLabel
                          info="Optional card surface color for the embedded shell."
                          label="Surface color"
                          optional
                        />
                        <input
                          className="console-input"
                          defaultValue={calendar.embed_theme.surface_color || ""}
                          name="embed_surface_color"
                          placeholder="#ffffff"
                          type="text"
                        />
                      </label>
                      <label className="console-field">
                        <ConsoleFieldLabel
                          info="Optional high-contrast text color override for the embed shell."
                          label="Text color"
                          optional
                        />
                        <input
                          className="console-input"
                          defaultValue={calendar.embed_theme.text_color || ""}
                          name="embed_text_color"
                          placeholder="#131b2d"
                          type="text"
                        />
                      </label>
                      <label className="console-field">
                        <ConsoleFieldLabel
                          info="Optional border radius for embedded cards, in pixels."
                          label="Corner radius"
                          optional
                        />
                        <input
                          className="console-input"
                          defaultValue={calendar.embed_theme.radius_px || ""}
                          name="embed_radius_px"
                          placeholder="22"
                          type="number"
                        />
                      </label>
                    </div>

                    <button className="button button-secondary button-small" type="submit">
                      Save embed settings
                    </button>
                  </form>

                  <div className="console-content">
                    <div className="console-inline-action">
                      <p className="subtle-text">
                        Embed status: {embedReady ? "ready" : "needs enabled events and an allowlist"}
                      </p>
                      <ConsoleInfoTip label="How embed mode works">
                        <p>
                          The iframe uses the same mirrored event pages as public checkout,
                          but renders in a compact embedded shell and emits resize and status
                          events to the parent window.
                        </p>
                      </ConsoleInfoTip>
                    </div>

                    {embedExampleEvents.length > 0 ? (
                      <div className="console-content">
                        {embedExampleEvents.map((event) => {
                          const url = buildEmbedEventUrl(
                            calendar.slug,
                            event.event_api_id,
                          );
                          return (
                            <label className="console-field" key={event.event_api_id}>
                              <ConsoleFieldLabel
                                info="Use this iframe tag in your app or CMS. The host page controls final width."
                                label={`Embed snippet · ${event.name}`}
                              />
                              <textarea
                                className="console-input"
                                readOnly
                                rows={4}
                                value={buildEmbedSnippet(
                                  url,
                                  `${detail.tenant.name} checkout for ${event.name}`,
                                  calendar.embed_default_height_px,
                                )}
                              />
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="subtle-text">
                        Enable at least one future ticketed event to generate a ready-to-paste
                        iframe snippet here.
                      </p>
                    )}
                  </div>
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
