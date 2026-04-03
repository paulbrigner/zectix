"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { ConsoleInfoTip } from "@/components/ConsoleInfoTip";
import { EmbedSnippetCopyButton } from "@/components/EmbedSnippetCopyButton";
import { EmbedBrandingFooter } from "@/components/EmbedBrandingFooter";
import { LocalDateTime } from "@/components/LocalDateTime";
import styles from "./TenantEmbedWorkspace.module.css";

type CalendarPreviewEvent = {
  id: string;
  name: string;
  priceLabel: string | null;
  startAt: string;
  ticketSummary: string;
};

type PreviewTicket = {
  id: string;
  name: string;
  priceLabel: string;
};

type CalendarEmbedEntry = {
  calendarName: string;
  events: CalendarPreviewEvent[];
  hiddenEventCount: number;
  id: string;
  kind: "calendar";
  label: string;
  showBranding: boolean;
  snippet: string;
  themeStyle: Record<string, string>;
  title: string;
};

type EventEmbedEntry = {
  calendarName: string;
  coverUrl: string | null;
  eventName: string;
  hiddenTicketCount: number;
  id: string;
  kind: "event";
  label: string;
  showBranding: boolean;
  snippet: string;
  startAt: string;
  summary: string;
  tickets: PreviewTicket[];
  themeStyle: Record<string, string>;
  title: string;
};

type TenantEmbedPreviewEntry = CalendarEmbedEntry | EventEmbedEntry;

function previewButtonClassName(active: boolean) {
  return `button ${active ? "button-attention" : "button-secondary"} button-small`;
}

export function TenantEmbedPreviewPicker({
  entries,
}: {
  entries: TenantEmbedPreviewEntry[];
}) {
  const [selectedPreviewId, setSelectedPreviewId] = useState<string | null>(null);

  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.id === selectedPreviewId) || null,
    [entries, selectedPreviewId],
  );

  function togglePreview(id: string) {
    setSelectedPreviewId((current) => (current === id ? null : id));
  }

  return (
    <>
      <div className={styles.snippetList}>
        {entries.map((entry) => {
          const isActive = entry.id === selectedPreviewId;

          return (
            <div className={styles.snippetRow} key={entry.id}>
              <div className={styles.snippetCopy}>
                <span className={styles.eyebrow}>{entry.label}</span>
                <span className={styles.snippetTitle}>{entry.title}</span>
              </div>
              <div className={styles.snippetActions}>
                <button
                  aria-pressed={isActive}
                  className={previewButtonClassName(isActive)}
                  onClick={() => togglePreview(entry.id)}
                  type="button"
                >
                  {isActive ? "Hide preview" : "Preview"}
                </button>
                <EmbedSnippetCopyButton value={entry.snippet} />
              </div>
            </div>
          );
        })}
      </div>

      {selectedEntry ? (
        <section className={styles.previewSection}>
          <div className={styles.previewSectionHead}>
            <h4 className={styles.previewSectionTitle}>
              {selectedEntry.kind === "calendar"
                ? "Calendar embed preview"
                : "Event embed preview"}
            </h4>
            <div className={styles.previewSectionMeta}>
              <ConsoleInfoTip label="How embed mode works">
                <p>
                  The iframe uses the same mirrored event pages as public
                  checkout, but renders in a compact embedded shell and emits
                  resize and status events to the parent window.
                </p>
              </ConsoleInfoTip>
            </div>
          </div>

          <div className={styles.previewFrame}>
            <div className={styles.previewViewport}>
              {selectedEntry.kind === "calendar" ? (
                <div
                  className={styles.previewShell}
                  style={selectedEntry.themeStyle as CSSProperties}
                >
                  <div className={styles.previewActionCard}>
                    <div>
                      <h4>{selectedEntry.calendarName}</h4>
                    </div>
                    <button
                      className={styles.previewActionButton}
                      type="button"
                    >
                      Browse events
                    </button>
                  </div>

                  <div className={styles.calendarPreviewList}>
                    {selectedEntry.events.length ? (
                      selectedEntry.events.map((event) => (
                        <div className={styles.calendarPreviewRow} key={event.id}>
                          <div className={styles.calendarPreviewCopy}>
                            <strong className={styles.calendarPreviewTitle}>
                              {event.name}
                            </strong>
                            <p className={styles.previewTime}>
                              <LocalDateTime iso={event.startAt} />
                            </p>
                          </div>
                          <div className={styles.calendarPreviewMeta}>
                            <span className={styles.calendarPreviewSummary}>
                              {event.ticketSummary}
                            </span>
                            {event.priceLabel ? (
                              <span className={styles.previewTicketPrice}>
                                {event.priceLabel}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="subtle-text">
                        Upcoming public events will appear here once they are
                        ready for embed.
                      </p>
                    )}

                    {selectedEntry.hiddenEventCount > 0 ? (
                      <p className="subtle-text">
                        + {selectedEntry.hiddenEventCount} more upcoming event
                        {selectedEntry.hiddenEventCount === 1 ? "" : "s"}
                      </p>
                    ) : null}
                  </div>

                  {selectedEntry.showBranding ? <EmbedBrandingFooter /> : null}
                </div>
              ) : (
                <div
                  className={styles.previewShell}
                  style={selectedEntry.themeStyle as CSSProperties}
                >
                  <div className={styles.previewHero}>
                    {selectedEntry.coverUrl ? (
                      <div className={styles.previewMedia}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          alt={selectedEntry.eventName}
                          src={selectedEntry.coverUrl}
                        />
                      </div>
                    ) : (
                      <div
                        className={`${styles.previewMedia} ${styles.previewMediaFallback}`}
                      >
                        <span>
                          {selectedEntry.eventName.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                    )}

                    <div className={styles.previewCopy}>
                      <h4>{selectedEntry.eventName}</h4>
                      <p className={styles.previewTime}>
                        <LocalDateTime iso={selectedEntry.startAt} />
                      </p>
                      <p className={styles.previewSummary}>
                        {selectedEntry.summary}
                      </p>
                    </div>
                  </div>

                  <div className={styles.previewActionCard}>
                    <div className={styles.previewActionHead}>
                      <button
                        className={styles.previewActionButton}
                        type="button"
                      >
                        Open checkout
                      </button>
                    </div>

                    {selectedEntry.tickets.length ? (
                      <div className={styles.previewTicketList}>
                        {selectedEntry.tickets.map((ticket) => (
                          <div
                            className={styles.previewTicketRow}
                            key={ticket.id}
                          >
                            <span className={styles.previewTicketName}>
                              {ticket.name}
                            </span>
                            <span className={styles.previewTicketPrice}>
                              {ticket.priceLabel}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="subtle-text">
                        Ticket tiers will appear here once this event has
                        mirrored pricing.
                      </p>
                    )}

                    {selectedEntry.hiddenTicketCount > 0 ? (
                      <p className="subtle-text">
                        + {selectedEntry.hiddenTicketCount} more mirrored ticket
                        {selectedEntry.hiddenTicketCount === 1 ? "" : "s"}
                      </p>
                    ) : null}
                  </div>

                  {selectedEntry.showBranding ? <EmbedBrandingFooter /> : null}
                </div>
              )}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
