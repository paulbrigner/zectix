import Link from "next/link";
import { updateCalendarEmbedSettingsAction } from "@/app/dashboard/actions";
import { ConsoleDisclosure } from "@/components/ConsoleDisclosure";
import { ConsoleFieldLabel } from "@/components/ConsoleFieldLabel";
import { ConsoleFormPendingNote } from "@/components/ConsoleFormPendingNote";
import { ConsoleInfoTip } from "@/components/ConsoleInfoTip";
import { ConsoleSubmitButton } from "@/components/ConsoleSubmitButton";
import { ConsoleSwitch } from "@/components/ConsoleSwitch";
import { appUrl } from "@/lib/app-paths";
import { selectUpcomingEvents } from "@/lib/embed";
import type { TenantOpsDetail } from "@/lib/tenancy/service";
import {
  buildEmbedCalendarUrl,
  buildEmbedEventUrl,
  buildEmbedSnippet,
  summarizeCalendarInventory,
} from "@/lib/tenant-self-serve";

export function TenantEmbedWorkspace({
  detail,
  tenantBasePath,
}: {
  detail: TenantOpsDetail;
  tenantBasePath: string;
}) {
  const embedBasePath = `${tenantBasePath}/embed`;

  return (
    <div className="console-page-body">
      {!detail.calendars.length ? (
        <section className="console-section">
          <div className="console-preview-empty">
            <strong>No calendars connected yet</strong>
            <p className="subtle-text">
              Set up a Luma calendar and a live checkout connection before
              generating embed snippets.
            </p>
          </div>
        </section>
      ) : (
        <section className="console-section">
          <div className="console-section-header">
            <div>
              <h2>Per-calendar embed settings</h2>
              <p className="subtle-text">
                Embedding is configured at the calendar level. The generated
                snippets use upcoming public events from that calendar.
              </p>
            </div>
          </div>

          <div className="console-luma-card-stack">
            {detail.calendars.map((calendar) => {
              const inventory = summarizeCalendarInventory(detail, calendar);
              const embedExampleEvents = selectUpcomingEvents(
                inventory.enabledEvents,
              );
              const calendarSnippetReady =
                calendar.embed_enabled &&
                calendar.embed_allowed_origins.length > 0;
              const embedReady =
                calendarSnippetReady && embedExampleEvents.length > 0;

              return (
                <article
                  className="console-detail-card console-luma-card"
                  key={calendar.calendar_connection_id}
                >
                  <div className="console-luma-card-head">
                    <div>
                      <p className="console-kpi-label">
                        {calendar.display_name}
                      </p>
                      <h3>
                        {embedReady
                          ? "Ready to publish"
                          : "Needs a few more things"}
                      </h3>
                      <p className="subtle-text">
                        {calendar.embed_enabled
                          ? `${calendar.embed_allowed_origins.length} allowed origin${calendar.embed_allowed_origins.length === 1 ? "" : "s"}`
                          : "Embedding is currently turned off"}
                      </p>
                    </div>
                    <div className="button-row">
                      <Link
                        className="button button-secondary button-small"
                        href={`${tenantBasePath}/connections`}
                      >
                        Connections
                      </Link>
                      <Link
                        className="button button-secondary button-small"
                        href={`${tenantBasePath}/events`}
                      >
                        Events
                      </Link>
                    </div>
                  </div>

                  <div className="console-signal-grid">
                    <div className="console-signal-card">
                      <span className="console-kpi-label">Embed mode</span>
                      <strong>
                        {calendar.embed_enabled ? "Enabled" : "Disabled"}
                      </strong>
                      <p className="subtle-text">
                        Turn this on to allow compact iframe rendering.
                      </p>
                    </div>
                    <div className="console-signal-card">
                      <span className="console-kpi-label">Allowed origins</span>
                      <strong>{calendar.embed_allowed_origins.length}</strong>
                      <p className="subtle-text">
                        Host applications must be listed here.
                      </p>
                    </div>
                    <div className="console-signal-card">
                      <span className="console-kpi-label">Public events</span>
                      <strong>{embedExampleEvents.length}</strong>
                      <p className="subtle-text">
                        Upcoming event
                        {embedExampleEvents.length === 1 ? "" : "s"} ready for
                        snippets.
                      </p>
                    </div>
                    <div className="console-signal-card">
                      <span className="console-kpi-label">Iframe height</span>
                      <strong>{calendar.embed_default_height_px}px</strong>
                      <p className="subtle-text">
                        Hosts can still override this per embed.
                      </p>
                    </div>
                  </div>

                  <ConsoleDisclosure
                    description="Open this panel to edit iframe settings, allowed origins, appearance overrides, and generated embed code."
                    title="Edit settings and snippets"
                  >
                    <form
                      action={updateCalendarEmbedSettingsAction}
                      className="console-content embed-settings-form"
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
                        value={embedBasePath}
                      />

                      <div className="embed-settings-top-grid">
                        <ConsoleSwitch
                          className="embed-toggle-card"
                          defaultChecked={calendar.embed_enabled}
                          description="Turn on iframe rendering for this calendar's event checkout entry pages."
                          label="Enable embedding"
                          name="embed_enabled"
                        />

                        <ConsoleSwitch
                          className="embed-toggle-card"
                          defaultChecked={calendar.embed_show_branding}
                          description="Keep the compact ZecTix and CipherPay branding footer visible inside the iframe."
                          label="Show branding"
                          name="embed_show_branding"
                        />

                        <label className="console-field embed-settings-height-card">
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
                      </div>

                      <section className="embed-settings-section">
                        <div className="embed-settings-section-head">
                          <h4>Allowed origins</h4>
                          <p className="subtle-text">
                            Enter one site origin per line, for example{" "}
                            <code>https://events.example.com</code>. Only these
                            origins can host the iframe.
                          </p>
                        </div>
                        <textarea
                          className="console-input embed-settings-textarea"
                          defaultValue={calendar.embed_allowed_origins.join(
                            "\n",
                          )}
                          name="embed_allowed_origins"
                          rows={4}
                        />
                      </section>

                      <section className="embed-settings-section">
                        <div className="embed-settings-section-head">
                          <h4>Appearance overrides</h4>
                          <p className="subtle-text">
                            Optional tweaks for accent, shell colors, and corner
                            radius inside the iframe.
                          </p>
                        </div>

                        <div className="public-field-grid embed-theme-grid">
                          <label className="console-field">
                            <ConsoleFieldLabel
                              info="Optional accent color override for embedded buttons and highlights."
                              label="Accent color"
                              optional
                            />
                            <input
                              className="console-input"
                              defaultValue={
                                calendar.embed_theme.accent_color || ""
                              }
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
                              defaultValue={
                                calendar.embed_theme.background_color || ""
                              }
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
                              defaultValue={
                                calendar.embed_theme.surface_color || ""
                              }
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
                              defaultValue={
                                calendar.embed_theme.text_color || ""
                              }
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
                              defaultValue={
                                calendar.embed_theme.radius_px || ""
                              }
                              name="embed_radius_px"
                              placeholder="22"
                              type="number"
                            />
                          </label>
                        </div>
                      </section>

                      <div className="button-row">
                        <ConsoleSubmitButton
                          className="button button-secondary button-small"
                          label="Save embed settings"
                          pendingLabel="Saving embed settings..."
                        />
                      </div>
                      <ConsoleFormPendingNote pendingLabel="Saving your embed settings..." />
                    </form>

                    <div className="console-inline-action">
                      <p className="subtle-text">
                        Embed status:{" "}
                        {embedReady
                          ? "ready to publish"
                          : "needs allowed origins and at least one public upcoming event"}
                      </p>
                      <ConsoleInfoTip label="How embed mode works">
                        <p>
                          The iframe uses the same mirrored event pages as
                          public checkout, but renders in a compact embedded
                          shell and emits resize and status events to the parent
                          window.
                        </p>
                      </ConsoleInfoTip>
                    </div>

                    <ConsoleDisclosure
                      description="Ready-to-paste iframe tags for the calendar landing view plus any upcoming public event embeds."
                      title="Generated calendar and event embeds"
                    >
                      {calendarSnippetReady ? (
                        <div className="console-content">
                          <label className="console-field">
                            <ConsoleFieldLabel
                              info="Use this iframe tag to embed the full public event list for this calendar."
                              label={`Calendar embed · ${calendar.display_name}`}
                            />
                            <textarea
                              className="console-input"
                              readOnly
                              rows={4}
                              value={buildEmbedSnippet(
                                appUrl(buildEmbedCalendarUrl(calendar.slug)) ||
                                  buildEmbedCalendarUrl(calendar.slug),
                                `${detail.tenant.name} calendar for ${calendar.display_name}`,
                                calendar.embed_default_height_px,
                              )}
                            />
                          </label>

                          {embedExampleEvents.map((event) => {
                            const relativeUrl = buildEmbedEventUrl(
                              calendar.slug,
                              event.event_api_id,
                            );
                            const url = appUrl(relativeUrl) || relativeUrl;
                            return (
                              <label
                                className="console-field"
                                key={event.event_api_id}
                              >
                                <ConsoleFieldLabel
                                  info="Use this iframe tag in your app or CMS. The host page controls final width."
                                  label={`Event embed · ${event.name}`}
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

                          {!embedExampleEvents.length ? (
                            <p className="subtle-text">
                              Calendar embed is ready. Event-specific snippets
                              will appear once this calendar has at least one
                              upcoming public event.
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <p className="subtle-text">
                          Turn on embedding and add at least one allowed origin
                          to generate ready-to-paste iframe snippets here.
                        </p>
                      )}
                    </ConsoleDisclosure>
                  </ConsoleDisclosure>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
