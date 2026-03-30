import Link from "next/link";
import { updateCalendarEmbedSettingsAction } from "@/app/dashboard/actions";
import { ConsoleDisclosure } from "@/components/ConsoleDisclosure";
import { ConsoleFieldLabel } from "@/components/ConsoleFieldLabel";
import { ConsoleInfoTip } from "@/components/ConsoleInfoTip";
import { appUrl } from "@/lib/app-paths";
import { selectUpcomingEvents } from "@/lib/embed";
import type { TenantOpsDetail } from "@/lib/tenancy/service";
import {
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
  const calendarsWithEmbed = detail.calendars.filter((calendar) => calendar.embed_enabled);
  const snippetReadyCalendars = detail.calendars.filter((calendar) => {
    const inventory = summarizeCalendarInventory(detail, calendar);
    return (
      calendar.embed_enabled &&
      calendar.embed_allowed_origins.length > 0 &&
      selectUpcomingEvents(inventory.enabledEvents).length > 0
    );
  });

  return (
    <div className="console-page-body">
      <section className="console-section">
        <div className="console-section-header">
          <div>
            <h2>Embed</h2>
            <p className="subtle-text">
              Generate iframe snippets, set allowlists, and tune the embedded checkout appearance
              without changing your public hosted flow.
            </p>
          </div>
          <Link className="button button-secondary button-small" href={`${tenantBasePath}/events`}>
            Review events first
          </Link>
        </div>

        <div className="console-kpi-grid">
          <article className="console-kpi-card">
            <p className="console-kpi-label">Calendars</p>
            <p className="console-kpi-value">{detail.calendars.length}</p>
            <p className="subtle-text console-kpi-detail">
              {calendarsWithEmbed.length} with embedding turned on
            </p>
          </article>
          <article className="console-kpi-card">
            <p className="console-kpi-label">Ready to publish</p>
            <p className="console-kpi-value">{snippetReadyCalendars.length}</p>
            <p className="subtle-text console-kpi-detail">
              calendars have an allowlist and at least one public event
            </p>
          </article>
          <article className="console-kpi-card">
            <p className="console-kpi-label">Allowed origins</p>
            <p className="console-kpi-value">
              {detail.calendars.reduce(
                (count, calendar) => count + calendar.embed_allowed_origins.length,
                0,
              )}
            </p>
            <p className="subtle-text console-kpi-detail">
              only listed origins can host the iframe
            </p>
          </article>
          <article className="console-kpi-card">
            <p className="console-kpi-label">Branding mode</p>
            <p className="console-kpi-value">
              {
                detail.calendars.filter((calendar) => calendar.embed_show_branding).length
              }
            </p>
            <p className="subtle-text console-kpi-detail">
              calendars currently keeping the compact header visible
            </p>
          </article>
        </div>
      </section>

      {!detail.calendars.length ? (
        <section className="console-section">
          <div className="console-preview-empty">
            <strong>No calendars connected yet</strong>
            <p className="subtle-text">
              Set up a Luma calendar and a live checkout connection before generating embed
              snippets.
            </p>
          </div>
        </section>
      ) : (
        <section className="console-section">
          <div className="console-section-header">
            <div>
              <h2>Per-calendar embed settings</h2>
              <p className="subtle-text">
                Embedding is configured at the calendar level. The generated snippets use upcoming
                public events from that calendar.
              </p>
            </div>
          </div>

          <div className="console-luma-card-stack">
            {detail.calendars.map((calendar) => {
              const inventory = summarizeCalendarInventory(detail, calendar);
              const embedExampleEvents = selectUpcomingEvents(
                inventory.enabledEvents,
              );
              const embedReady =
                calendar.embed_enabled &&
                calendar.embed_allowed_origins.length > 0 &&
                embedExampleEvents.length > 0;

              return (
                <article
                  className="console-detail-card console-luma-card"
                  key={calendar.calendar_connection_id}
                >
                  <div className="console-luma-card-head">
                    <div>
                      <p className="console-kpi-label">{calendar.display_name}</p>
                      <h3>
                        {embedReady ? "Ready to publish" : "Needs a few more things"}
                      </h3>
                      <p className="subtle-text">
                        {calendar.embed_enabled
                          ? `${calendar.embed_allowed_origins.length} allowed origin${calendar.embed_allowed_origins.length === 1 ? "" : "s"}`
                          : "Embedding is currently turned off"}
                      </p>
                    </div>
                    <div className="button-row">
                      <Link className="button button-secondary button-small" href={`${tenantBasePath}/connections`}>
                        Connections
                      </Link>
                      <Link className="button button-secondary button-small" href={`${tenantBasePath}/events`}>
                        Events
                      </Link>
                    </div>
                  </div>

                  <div className="console-signal-grid">
                    <div className="console-signal-card">
                      <span className="console-kpi-label">Embed mode</span>
                      <strong>{calendar.embed_enabled ? "Enabled" : "Disabled"}</strong>
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
                        upcoming event{embedExampleEvents.length === 1 ? "" : "s"} ready for snippets
                      </p>
                    </div>
                    <div className="console-signal-card">
                      <span className="console-kpi-label">Iframe height</span>
                      <strong>{calendar.embed_default_height_px}px</strong>
                      <p className="subtle-text">
                        hosts can still override this per embed
                      </p>
                    </div>
                  </div>

                  <form action={updateCalendarEmbedSettingsAction} className="console-content">
                    <input
                      name="calendar_connection_id"
                      type="hidden"
                      value={calendar.calendar_connection_id}
                    />
                    <input name="tenant_slug" type="hidden" value={detail.tenant.slug} />
                    <input name="redirect_to" type="hidden" value={embedBasePath} />

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

                  <div className="console-inline-action">
                    <p className="subtle-text">
                      Embed status: {embedReady ? "ready to publish" : "needs allowed origins and at least one public upcoming event"}
                    </p>
                    <ConsoleInfoTip label="How embed mode works">
                      <p>
                        The iframe uses the same mirrored event pages as public checkout, but
                        renders in a compact embedded shell and emits resize and status events to
                        the parent window.
                      </p>
                    </ConsoleInfoTip>
                  </div>

                  <ConsoleDisclosure
                    defaultOpen={embedReady}
                    description="Ready-to-paste iframe tags for upcoming public events on this calendar."
                    title="Generated iframe snippets"
                  >
                    {embedExampleEvents.length > 0 ? (
                      <div className="console-content">
                        {embedExampleEvents.map((event) => {
                          const relativeUrl = buildEmbedEventUrl(
                            calendar.slug,
                            event.event_api_id,
                          );
                          const url = appUrl(relativeUrl) || relativeUrl;
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
                        Enable at least one future public event to generate a ready-to-paste iframe
                        snippet here.
                      </p>
                    )}
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
