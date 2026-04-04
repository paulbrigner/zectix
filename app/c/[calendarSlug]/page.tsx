import Link from "next/link";
import type { CSSProperties } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { EmbedBrandingFooter } from "@/components/EmbedBrandingFooter";
import { EmbedFrameBridge } from "@/components/EmbedFrameBridge";
import {
  buildEmbedThemeStyle,
  createEmbedParentToken,
  isCalendarEmbedEnabled,
  resolveEmbedParentOrigin,
} from "@/lib/embed";
import { getPublicCalendar } from "@/lib/public/public-calendars";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function eventDateLabel(value: string, timeZone = "America/New_York") {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}

function eventCalendarLeaf(value: string, timeZone = "America/New_York") {
  const date = new Date(value);
  const month = new Intl.DateTimeFormat(undefined, { month: "short", timeZone }).format(date).toUpperCase();
  const day = new Intl.DateTimeFormat(undefined, { day: "numeric", timeZone }).format(date);
  return { month, day };
}

export default async function PublicCalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ calendarSlug: string }>;
  searchParams: Promise<{ embed?: string; et?: string; po?: string }>;
}) {
  const { calendarSlug } = await params;
  const resolvedSearchParams = await searchParams;
  const data = await getPublicCalendar(calendarSlug);
  if (!data) {
    notFound();
  }

  const embedMode = resolvedSearchParams.embed === "1";
  let embedParentOrigin: string | null = null;
  let embedParentToken: string | null = null;

  if (embedMode) {
    if (!isCalendarEmbedEnabled(data.calendar)) {
      notFound();
    }

    const requestHeaders = await headers();
    embedParentOrigin = resolveEmbedParentOrigin({
      calendarConnectionId: data.calendar.calendar_connection_id,
      allowedOrigins: data.calendar.embed_allowed_origins,
      requestHeaders,
      parentToken: resolvedSearchParams.et || null,
      parentOriginHint: resolvedSearchParams.po || null,
    });
    if (!embedParentOrigin) {
      notFound();
    }

    embedParentToken =
      resolvedSearchParams.et ||
      createEmbedParentToken(
        data.calendar.calendar_connection_id,
        embedParentOrigin,
      ) ||
      null;
  }

  const pageStyle = embedMode
    ? (buildEmbedThemeStyle(data.calendar.embed_theme) as CSSProperties)
    : undefined;
  const embedEventQuery =
    embedMode && embedParentOrigin
      ? new URLSearchParams({
          embed: "1",
          ...(embedParentToken ? { et: embedParentToken } : {}),
          po: embedParentOrigin,
        }).toString()
      : null;

  return (
    <main
      className={`public-home-shell${embedMode ? " embed-page-shell embed-calendar-shell" : ""}`}
      style={pageStyle}
    >
      {embedMode ? (
        <EmbedFrameBridge
          calendarSlug={data.calendar.slug}
          enabled
          parentOrigin={embedParentOrigin}
          view="calendar"
        />
      ) : null}
      <div
        className={`public-home-main${embedMode ? " embed-calendar-main" : ""}`}
      >
        <section className="card event-page-card">
          {!embedMode ? (
            <div className="public-home-topbar">
              <div className="public-brand">
                <span>{data.tenant.name}</span>
                <span className="public-brand-context">Events</span>
              </div>
            </div>
          ) : null}

          <section className="public-events-section">
            {!embedMode ? (
              <div className="public-section-heading">
                <h1>Upcoming events</h1>
                <p className="subtle-text">
                  Secure your spot with private Zcash checkout.
                </p>
              </div>
            ) : null}

            {data.events.length === 0 ? (
              <div className="home-empty-state">
                <h3>No events yet</h3>
                <p>
                  No Zcash-enabled events are currently available.
                </p>
              </div>
            ) : (
              <div className="public-event-list">
                {data.events.map((event) => (
                  <Link
                    className="public-event-row"
                    href={`/c/${encodeURIComponent(data.calendar.slug)}/events/${encodeURIComponent(event.event_api_id)}${embedEventQuery ? `?${embedEventQuery}` : ""}`}
                    key={event.event_api_id}
                  >
                    <div className="public-event-icon" aria-hidden="true">
                      {event.cover_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt={event.name}
                          className="public-event-icon-image"
                          src={event.cover_url}
                        />
                      ) : (() => {
                        const leaf = eventCalendarLeaf(event.start_at, event.timezone || undefined);
                        return (
                          <>
                            <span className="public-event-icon-month">{leaf.month}</span>
                            <span className="public-event-icon-day">{leaf.day}</span>
                          </>
                        );
                      })()}
                    </div>
                    <div className="public-event-row-copy">
                      <h3>{event.name}</h3>
                      <p className="subtle-text">
                        {eventDateLabel(
                          event.start_at,
                          event.timezone || undefined,
                        )}
                        {event.location_label
                          ? ` · ${event.location_label}`
                          : ""}
                      </p>
                    </div>
                    <span className="public-row-action button button-small">Get tickets</span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {embedMode ? (
            data.calendar.embed_show_branding ? <EmbedBrandingFooter /> : null
          ) : (
            <EmbedBrandingFooter />
          )}
        </section>
      </div>
    </main>
  );
}
