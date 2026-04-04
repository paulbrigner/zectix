import { updateCalendarEmbedSettingsAction } from "@/app/dashboard/actions";
import { ColorHexInput } from "@/components/ColorHexInput";
import { ConsoleDisclosure } from "@/components/ConsoleDisclosure";
import { EmbedLiveThemeProvider } from "@/components/EmbedLiveThemeProvider";
import { ConsoleFieldLabel } from "@/components/ConsoleFieldLabel";
import { ConsoleFormPendingNote } from "@/components/ConsoleFormPendingNote";
import { ConsoleSubmitButton } from "@/components/ConsoleSubmitButton";
import { ConsoleSwitch } from "@/components/ConsoleSwitch";
import { EmbedAppearanceResetButton } from "@/components/EmbedAppearanceResetButton";
import { LiveDimensionInput } from "@/components/LiveDimensionInput";
import { TenantEmbedPreviewPicker } from "@/components/TenantEmbedPreviewPicker";
import { appUrl } from "@/lib/app-paths";
import type { TicketMirror } from "@/lib/app-state/types";
import { formatFiatAmount } from "@/lib/app-state/utils";
import {
  DEFAULT_EMBED_HEIGHT_PX,
  buildEmbedThemeStyle,
  selectUpcomingEvents,
} from "@/lib/embed";
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

function previewStatusClassName(embedReady: boolean) {
  return `${styles.statusPill} ${embedReady ? styles.statusReady : ""}`.trim();
}

function pickPreviewTickets(tickets: readonly TicketMirror[]) {
  const groups = [
    tickets.filter((ticket) => ticket.zcash_enabled),
    tickets.filter((ticket) => ticket.public_checkout_requested),
    tickets.filter((ticket) => ticket.active),
    tickets,
  ];

  const firstMatchingGroup = groups.find((group) => group.length > 0) || [];
  return firstMatchingGroup.slice(0, 4);
}

function lowestPricedTicketLabel(tickets: readonly TicketMirror[]) {
  const pricedTickets = tickets.filter(
    (ticket) => ticket.amount != null && ticket.currency,
  );
  if (!pricedTickets.length) {
    return null;
  }

  const [lowestPricedTicket] = [...pricedTickets].sort((left, right) => {
    if (left.currency !== right.currency) {
      return String(left.currency).localeCompare(String(right.currency));
    }

    return (left.amount ?? 0) - (right.amount ?? 0);
  });

  return formatFiatAmount(
    lowestPricedTicket.amount,
    lowestPricedTicket.currency,
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

  function renderCalendarSection(
    calendar: TenantOpsDetail["calendars"][number],
    singleCalendarShell: boolean,
  ) {
    const settingsFormKey = JSON.stringify({
      allowedOrigins: calendar.embed_allowed_origins,
      defaultHeight: calendar.embed_default_height_px,
      embedEnabled: calendar.embed_enabled,
      radius: calendar.embed_theme.radius_px,
      showBranding: calendar.embed_show_branding,
      theme: calendar.embed_theme,
    });
    const inventory = summarizeCalendarInventory(detail, calendar);
    const embedExampleEvents = selectUpcomingEvents(inventory.enabledEvents);
    const calendarSnippetReady =
      calendar.embed_enabled && calendar.embed_allowed_origins.length > 0;
    const embedReady = calendarSnippetReady && embedExampleEvents.length > 0;
    const embedEntries = calendarSnippetReady
      ? [
          {
            calendarName: calendar.display_name,
            events: embedExampleEvents.slice(0, 3).map((event) => {
              const eventTickets =
                detail.tickets_by_event.get(event.event_api_id) || [];
              const previewDisplayTickets = pickPreviewTickets(eventTickets);

              return {
                id: event.event_api_id,
                name: event.name,
                priceLabel: lowestPricedTicketLabel(previewDisplayTickets),
                startAt: event.start_at,
                ticketSummary: previewDisplayTickets.length
                  ? `${previewDisplayTickets.length} ticket option${previewDisplayTickets.length === 1 ? "" : "s"}`
                  : "Ticket options appear at checkout",
              };
            }),
            hiddenEventCount: Math.max(embedExampleEvents.length - 3, 0),
            id: `calendar:${calendar.calendar_connection_id}`,
            kind: "calendar" as const,
            label: "Calendar embed",
            showBranding: calendar.embed_show_branding,
            snippet: buildEmbedSnippet(
              appUrl(buildEmbedCalendarUrl(calendar.slug)) ||
                buildEmbedCalendarUrl(calendar.slug),
              `${detail.tenant.name} calendar for ${calendar.display_name}`,
              calendar.embed_default_height_px,
            ),
            themeStyle: buildEmbedThemeStyle(calendar.embed_theme),
            title: calendar.display_name,
          },
          ...embedExampleEvents.map((event) => {
            const relativeUrl = buildEmbedEventUrl(
              calendar.slug,
              event.event_api_id,
            );
            const url = appUrl(relativeUrl) || relativeUrl;
            const eventTickets =
              detail.tickets_by_event.get(event.event_api_id) || [];
            const previewDisplayTickets = pickPreviewTickets(eventTickets);

            return {
              calendarName: calendar.display_name,
              coverUrl: event.cover_url,
              eventName: event.name,
              hiddenTicketCount: Math.max(
                eventTickets.length - previewDisplayTickets.length,
                0,
              ),
              id: `event:${event.event_api_id}`,
              kind: "event" as const,
              label: "Event embed",
              showBranding: calendar.embed_show_branding,
              snippet: buildEmbedSnippet(
                url,
                `${detail.tenant.name} checkout for ${event.name}`,
                calendar.embed_default_height_px,
              ),
              startAt: event.start_at,
              summary: summarizeDescription(event.description),
              tickets: previewDisplayTickets.map((ticket) => ({
                id: ticket.ticket_mirror_id,
                name: ticket.name,
                priceLabel: formatFiatAmount(ticket.amount, ticket.currency),
              })),
              themeStyle: buildEmbedThemeStyle(calendar.embed_theme),
              title: event.name,
            };
          }),
        ]
      : [];

    const settingsForm = (
      <ConsoleDisclosure
        defaultOpen={!calendarSnippetReady}
        lockedOpen={!calendarSnippetReady}
        summaryExtras={
          <>
            <span className={previewStatusClassName(embedReady)}>
              {calendar.embed_enabled ? "Embed enabled" : "Embed off"}
            </span>
            <span className={`${styles.statusPill} ${styles.statusInfo}`}>
              {calendar.embed_allowed_origins.length} allowed origin
              {calendar.embed_allowed_origins.length === 1 ? "" : "s"}
            </span>
          </>
        }
        title="Edit settings"
      >
        <form
          action={updateCalendarEmbedSettingsAction}
          className="console-content embed-settings-form"
          key={settingsFormKey}
        >
          <input
            name="calendar_connection_id"
            type="hidden"
            value={calendar.calendar_connection_id}
          />
          <input name="tenant_slug" type="hidden" value={detail.tenant.slug} />
          <input name="redirect_to" type="hidden" value={embedBasePath} />

          <div className="embed-settings-top-grid">
            <ConsoleSwitch
              className="embed-toggle-card"
              defaultChecked={calendar.embed_enabled}
              description="Allow this calendar to appear as an embed on approved websites."
              label="Enable embedding"
              name="embed_enabled"
            />

            <ConsoleSwitch
              className="embed-toggle-card"
              defaultChecked={calendar.embed_show_branding}
              description="Show the ZecTix and CipherPay footer inside the embed."
              label="Show branding"
              name="embed_show_branding"
            />
          </div>

          <section className="embed-settings-section">
            <div className="embed-settings-section-head">
              <h4>Allowed origins</h4>
              <p className="subtle-text">
                Enter one website address per line, for example{" "}
                <code>https://events.example.com</code>. Only the sites listed
                here can display the embed.
              </p>
            </div>
            <textarea
              className="console-input embed-settings-textarea"
              defaultValue={calendar.embed_allowed_origins.join("\n")}
              name="embed_allowed_origins"
              rows={4}
            />
          </section>

          <section className="embed-settings-section">
            <div className="public-field-grid embed-theme-grid">
              <div className="console-field">
                <ConsoleFieldLabel
                  info="Optional button and highlight color inside the embed."
                  label="Accent color"
                  optional
                />
                <ColorHexInput
                  defaultValue={calendar.embed_theme.accent_color || ""}
                  name="embed_accent_color"
                  placeholder="#d4920a"
                  themeKey="accent_color"
                />
              </div>
              <div className="console-field">
                <ConsoleFieldLabel
                  info="Optional page background color inside the embed."
                  label="Background color"
                  optional
                />
                <ColorHexInput
                  defaultValue={calendar.embed_theme.background_color || ""}
                  name="embed_background_color"
                  placeholder="#fafaf9"
                  themeKey="background_color"
                />
              </div>
              <div className="console-field">
                <ConsoleFieldLabel
                  info="Optional card background color inside the embed."
                  label="Surface color"
                  optional
                />
                <ColorHexInput
                  defaultValue={calendar.embed_theme.surface_color || ""}
                  name="embed_surface_color"
                  placeholder="#ffffff"
                  themeKey="surface_color"
                />
              </div>
              <div className="console-field">
                <ConsoleFieldLabel
                  info="Optional text color for headings and body copy."
                  label="Text color"
                  optional
                />
                <ColorHexInput
                  defaultValue={calendar.embed_theme.text_color || ""}
                  name="embed_text_color"
                  placeholder="#131b2d"
                  themeKey="text_color"
                />
              </div>
              <div className="console-field">
                <ConsoleFieldLabel
                  info="Choose the starting height for copied embed code. You can still adjust it later on your site if needed."
                  label="Default iframe height"
                />
                <div className="console-input-with-unit">
                  <LiveDimensionInput
                    defaultValue={calendar.embed_default_height_px}
                    min={480}
                    name="embed_default_height_px"
                  />
                  <span className="console-input-unit">px</span>
                </div>
              </div>
              <div className="console-field">
                <ConsoleFieldLabel
                  info="Optional corner roundness for cards inside the embed."
                  label="Corner radius"
                  optional
                />
                <div className="console-input-with-unit">
                  <LiveDimensionInput
                    defaultValue={calendar.embed_theme.radius_px || ""}
                    name="embed_radius_px"
                    placeholder="22"
                    themeKey="radius_px"
                  />
                  <span className="console-input-unit">px</span>
                </div>
              </div>
            </div>
          </section>

          <div className={styles.settingsActions}>
            <EmbedAppearanceResetButton
              defaultHeight={DEFAULT_EMBED_HEIGHT_PX}
            />
            <ConsoleSubmitButton
              className="button button-attention button-small"
              label="Save embed settings"
              pendingLabel="Saving embed settings..."
            />
          </div>
          <ConsoleFormPendingNote pendingLabel="Saving your embed settings..." />
        </form>
      </ConsoleDisclosure>
    );

    const settingsAndPreview = (
      <EmbedLiveThemeProvider>
      <div className="embed-settings-layout">
        {calendarSnippetReady ? (
          <TenantEmbedPreviewPicker
            entries={embedEntries}
            settingsPanel={settingsForm}
          />
        ) : (
          <div className="embed-settings-no-entries">
            {settingsForm}
            <p className="subtle-text">
              Turn on embedding and add at least one allowed origin to generate
              copy-ready HTML.
            </p>
          </div>
        )}
      </div>
      </EmbedLiveThemeProvider>
    );

    if (singleCalendarShell) {
      return settingsAndPreview;
    }

    return (
      <article
        className="console-detail-card console-luma-card"
        key={calendar.calendar_connection_id}
      >
        <div className={styles.cardHead}>
          <div>
            <p className="console-kpi-label">{calendar.display_name}</p>
            <h3 className={styles.cardTitle}>
              {embedReady ? "Ready to publish" : "Needs a few more things"}
            </h3>
          </div>
          <div className={styles.headStatus}>
            <span className={previewStatusClassName(embedReady)}>
              {calendar.embed_enabled ? "Embed enabled" : "Embed off"}
            </span>
            <span className={`${styles.statusPill} ${styles.statusInfo}`}>
              {calendar.embed_allowed_origins.length} allowed origin
              {calendar.embed_allowed_origins.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        {settingsAndPreview}
      </article>
    );
  }

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
      ) : detail.calendars.length === 1 ? (
        renderCalendarSection(detail.calendars[0], true)
      ) : (
        <section className="console-section">
          <div className="console-luma-card-stack">
            {detail.calendars.map((calendar) =>
              renderCalendarSection(calendar, false),
            )}
          </div>
        </section>
      )}
    </div>
  );
}
