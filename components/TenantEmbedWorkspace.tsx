import { updateCalendarEmbedSettingsAction } from "@/app/dashboard/actions";
import { ConsoleDisclosure } from "@/components/ConsoleDisclosure";
import { EmbedSnippetCopyButton } from "@/components/EmbedSnippetCopyButton";
import { ConsoleFieldLabel } from "@/components/ConsoleFieldLabel";
import { ConsoleFormPendingNote } from "@/components/ConsoleFormPendingNote";
import { ConsoleInfoTip } from "@/components/ConsoleInfoTip";
import { LocalDateTime } from "@/components/LocalDateTime";
import { ConsoleSubmitButton } from "@/components/ConsoleSubmitButton";
import { ConsoleSwitch } from "@/components/ConsoleSwitch";
import { appUrl } from "@/lib/app-paths";
import type { TicketMirror } from "@/lib/app-state/types";
import { formatFiatAmount } from "@/lib/app-state/utils";
import { selectUpcomingEvents } from "@/lib/embed";
import type { TenantOpsDetail } from "@/lib/tenancy/service";
import {
  buildEmbedCalendarUrl,
  buildEmbedEventUrl,
  buildEmbedSnippet,
  summarizeCalendarInventory,
} from "@/lib/tenant-self-serve";
import styles from "./TenantEmbedWorkspace.module.css";

function summarizeDescription(value: string | null) {
  if (!value) {
    return "Visitors land on a focused event page with the schedule, a clear registration call-to-action, and host context.";
  }

  const plainText = value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!plainText) {
    return "Visitors land on a focused event page with the schedule, a clear registration call-to-action, and host context.";
  }

  return plainText.length > 170 ? `${plainText.slice(0, 167)}...` : plainText;
}

function primaryOrigin(origins: string[]) {
  return origins[0] || "https://events.example.com";
}

function previewStatusClassName(embedReady: boolean) {
  return `${styles.statusPill} ${embedReady ? styles.statusReady : ""}`.trim();
}

function pickPreviewTicket(tickets: readonly TicketMirror[]) {
  return (
    tickets.find((ticket) => ticket.zcash_enabled) ||
    tickets.find((ticket) => ticket.public_checkout_requested) ||
    tickets.find((ticket) => ticket.active) ||
    tickets[0] ||
    null
  );
}

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
            </div>
          </div>

          <div className="console-luma-card-stack">
            {detail.calendars.map((calendar) => {
              const inventory = summarizeCalendarInventory(detail, calendar);
              const embedExampleEvents = selectUpcomingEvents(inventory.enabledEvents);
              const fallbackEvents =
                inventory.futureMirroredEvents.length > 0
                  ? inventory.futureMirroredEvents
                  : inventory.mirroredEvents;
              const previewEvent = embedExampleEvents[0] || fallbackEvents[0] || null;
              const previewTickets = previewEvent
                ? detail.tickets_by_event.get(previewEvent.event_api_id) || []
                : [];
              const previewTicket = pickPreviewTicket(previewTickets);
              const calendarSnippetReady =
                calendar.embed_enabled &&
                calendar.embed_allowed_origins.length > 0;
              const embedReady =
                calendarSnippetReady && embedExampleEvents.length > 0;
              const previewUrl = previewEvent
                ? appUrl(buildEmbedEventUrl(calendar.slug, previewEvent.event_api_id)) ||
                  buildEmbedEventUrl(calendar.slug, previewEvent.event_api_id)
                : appUrl(buildEmbedCalendarUrl(calendar.slug)) ||
                  buildEmbedCalendarUrl(calendar.slug);

              return (
                <article
                  className="console-detail-card console-luma-card"
                  key={calendar.calendar_connection_id}
                >
                  <div className={styles.cardHead}>
                    <div>
                      <p className="console-kpi-label">
                        {calendar.display_name}
                      </p>
                      <h3 className={styles.cardTitle}>
                        {embedReady
                          ? "Ready to publish"
                          : "Needs a few more things"}
                      </h3>
                      <p className="subtle-text">
                        Lead with the event preview, then keep setup and embed
                        outputs tucked into a disclosure below it.
                      </p>
                    </div>
                    <div className={styles.headStatus}>
                      <span className={previewStatusClassName(embedReady)}>
                        {calendar.embed_enabled ? "Embed enabled" : "Embed off"}
                      </span>
                      <span
                        className={`${styles.statusPill} ${styles.statusInfo}`}
                      >
                        {calendar.embed_allowed_origins.length} allowed origin
                        {calendar.embed_allowed_origins.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>

                  <div className={styles.modeRow}>
                    <button className={styles.modeCard} disabled type="button">
                      Embed as button
                    </button>
                    <button
                      aria-pressed="true"
                      className={`${styles.modeCard} ${styles.modeCardActive}`}
                      disabled
                      type="button"
                    >
                      Embed event page
                    </button>
                  </div>

                  <div className={styles.previewFrame}>
                    <div className={styles.previewChrome}>
                      <span className={styles.previewOrigin}>
                        {primaryOrigin(calendar.embed_allowed_origins)}
                      </span>
                      <span className={styles.previewPath}>{previewUrl}</span>
                    </div>

                    <div className={styles.previewViewport}>
                      {previewEvent ? (
                        <div className={styles.previewShell}>
                          <div className={styles.previewHero}>
                            {previewEvent.cover_url ? (
                              <div className={styles.previewMedia}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  alt={previewEvent.name}
                                  src={previewEvent.cover_url}
                                />
                              </div>
                            ) : (
                              <div
                                className={`${styles.previewMedia} ${styles.previewMediaFallback}`}
                              >
                                <span>
                                  {previewEvent.name.slice(0, 2).toUpperCase()}
                                </span>
                              </div>
                            )}

                            <div className={styles.previewCopy}>
                              <div className={styles.previewMetaRow}>
                                <span className={styles.previewBadge}>
                                  Event page
                                </span>
                                <span className={styles.previewBadgeMuted}>
                                  {calendar.display_name}
                                </span>
                              </div>
                              <h4>{previewEvent.name}</h4>
                              <p className={styles.previewTime}>
                                <LocalDateTime iso={previewEvent.start_at} />
                              </p>
                              <p className={styles.previewSummary}>
                                {summarizeDescription(previewEvent.description)}
                              </p>
                            </div>
                          </div>

                          <div className={styles.previewActionCard}>
                            <div>
                              <span className={styles.eyebrow}>Get tickets</span>
                              <strong className={styles.price}>
                                {previewTicket
                                  ? formatFiatAmount(
                                      previewTicket.amount,
                                      previewTicket.currency,
                                    )
                                  : "Available at checkout"}
                              </strong>
                            </div>
                            <button
                              className={styles.previewActionButton}
                              type="button"
                            >
                              Open checkout
                            </button>
                          </div>

                          <div className={styles.previewInfoGrid}>
                            <div className={styles.previewInfoCard}>
                              <span className={styles.eyebrow}>Default height</span>
                              <strong>{calendar.embed_default_height_px}px</strong>
                              <p className="subtle-text">
                                Hosts can still override this when they need a
                                taller or shorter embed shell.
                              </p>
                            </div>
                            <div className={styles.previewInfoCard}>
                              <span className={styles.eyebrow}>Allowed host</span>
                              <strong>{primaryOrigin(calendar.embed_allowed_origins)}</strong>
                              <p className="subtle-text">
                                Keep the allowlist near the preview so it is
                                obvious where the iframe can be published.
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className={styles.emptyPreview}>
                          <strong>No upcoming event preview yet</strong>
                          <p className="subtle-text">
                            Once this calendar has a mirrored event, the live
                            preview can show the focused event-page embed here.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <ConsoleDisclosure
                    defaultOpen={!calendarSnippetReady}
                    description="Keep the preview visible up front and fold the editing tools underneath it."
                    title="Edit settings and snippets"
                  >
                    <div className={styles.disclosureCard}>
                      <ConsoleDisclosure
                        defaultOpen={!calendarSnippetReady}
                        description={
                          calendarSnippetReady
                            ? "After embeds are available, settings can collapse so the copy actions stay easier to scan."
                            : "Keep settings open until the first embed is actually ready."
                        }
                        lockedOpen={!calendarSnippetReady}
                        title="Settings"
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

                          <div className={styles.settingsSummaryGrid}>
                            <div className={styles.settingsSummaryCard}>
                              <span className={styles.eyebrow}>Embed mode</span>
                              <strong>
                                {calendar.embed_enabled ? "Enabled" : "Disabled"}
                              </strong>
                              <p className="subtle-text">
                                Turn on iframe rendering for this calendar&apos;s
                                event checkout entry pages.
                              </p>
                            </div>
                            <div className={styles.settingsSummaryCard}>
                              <span className={styles.eyebrow}>Allowed origins</span>
                              <strong>
                                {calendar.embed_allowed_origins.length === 0
                                  ? "Needs at least one"
                                  : `${calendar.embed_allowed_origins.length} configured`}
                              </strong>
                              <p className="subtle-text">
                                Host allowlists stay near the save action
                                because they gate whether embeds can publish.
                              </p>
                            </div>
                            <div className={styles.settingsSummaryCard}>
                              <span className={styles.eyebrow}>Outputs</span>
                              <strong>
                                {previewEvent
                                  ? "Calendar and event"
                                  : "Calendar only"}
                              </strong>
                              <p className="subtle-text">
                                Copy actions can live below without forcing raw
                                HTML to dominate the page.
                              </p>
                            </div>
                          </div>

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
                                <code>https://events.example.com</code>. Only
                                these origins can host the iframe.
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

                          <ConsoleDisclosure
                            className={styles.nestedDisclosure}
                            description="Accent, surface, text, branding, and radius controls can stay tucked away until someone wants to tune the visual polish."
                            title="Appearance overrides"
                          >
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
                          </ConsoleDisclosure>

                          <div className={styles.settingsActions}>
                            <ConsoleSubmitButton
                              className="button button-attention button-small"
                              label="Save embed settings"
                              pendingLabel="Saving embed settings..."
                            />
                            <p className="subtle-text">
                              Keep the save action visually anchored at the
                              bottom of settings so it is easy to find after
                              changes.
                            </p>
                          </div>
                          <ConsoleFormPendingNote pendingLabel="Saving your embed settings..." />
                        </form>
                      </ConsoleDisclosure>

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
                            shell and emits resize and status events to the
                            parent window.
                          </p>
                        </ConsoleInfoTip>
                      </div>

                      <ConsoleDisclosure
                        defaultOpen={calendarSnippetReady}
                        description="Copy ready-to-paste iframe HTML for the calendar landing view or any upcoming public event."
                        title="Generated embeds"
                      >
                        {calendarSnippetReady ? (
                          <div className={styles.snippetList}>
                            <div className={styles.snippetRow}>
                              <div className={styles.snippetCopy}>
                                <span className={styles.eyebrow}>
                                  Calendar embed
                                </span>
                                <span className={styles.snippetTitle}>
                                  {calendar.display_name}
                                </span>
                                <span className={styles.snippetPath}>
                                  {appUrl(buildEmbedCalendarUrl(calendar.slug)) ||
                                    buildEmbedCalendarUrl(calendar.slug)}
                                </span>
                              </div>
                              <EmbedSnippetCopyButton
                                value={buildEmbedSnippet(
                                  appUrl(buildEmbedCalendarUrl(calendar.slug)) ||
                                    buildEmbedCalendarUrl(calendar.slug),
                                  `${detail.tenant.name} calendar for ${calendar.display_name}`,
                                  calendar.embed_default_height_px,
                                )}
                              />
                            </div>

                            {embedExampleEvents.map((event) => {
                              const relativeUrl = buildEmbedEventUrl(
                                calendar.slug,
                                event.event_api_id,
                              );
                              const url = appUrl(relativeUrl) || relativeUrl;

                              return (
                                <div
                                  className={styles.snippetRow}
                                  key={event.event_api_id}
                                >
                                  <div className={styles.snippetCopy}>
                                    <span className={styles.eyebrow}>
                                      Event embed
                                    </span>
                                    <span className={styles.snippetTitle}>
                                      {event.name}
                                    </span>
                                    <span className={styles.snippetPath}>
                                      {url}
                                    </span>
                                  </div>
                                  <EmbedSnippetCopyButton
                                    value={buildEmbedSnippet(
                                      url,
                                      `${detail.tenant.name} checkout for ${event.name}`,
                                      calendar.embed_default_height_px,
                                    )}
                                  />
                                </div>
                              );
                            })}

                            {!embedExampleEvents.length ? (
                              <p className="subtle-text">
                                Calendar embed is ready. Event-specific embeds
                                will appear once this calendar has at least one
                                upcoming public event.
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <p className="subtle-text">
                            Turn on embedding and add at least one allowed
                            origin to generate copy-ready HTML here.
                          </p>
                        )}
                      </ConsoleDisclosure>
                    </div>
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
