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

function eventInitials(name: string) {
  const initials = name
    .split(/\s+/)
    .map((part) => part.trim()[0] || "")
    .filter(Boolean)
    .slice(0, 2)
    .join("");

  return initials.toUpperCase() || "ZE";
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
        {!embedMode ? (
          <div
            className={`public-home-topbar${embedMode ? " embed-page-topbar" : ""}`}
          >
            <div className="public-brand">
              <span>
                {embedMode ? data.calendar.display_name : data.tenant.name}
              </span>
            </div>
            {!embedMode ? (
              <Link className="button button-secondary button-small" href="/">
                Service home
              </Link>
            ) : null}
          </div>
        ) : null}

        <section className="public-events-section">
          {!embedMode ? (
            <div className="public-section-heading">
              <p className="eyebrow">Public calendar</p>
              <h1 className="public-display">Upcoming events</h1>
              <p className="subtle-text">
                {data.calendar.display_name} events that were mirrored from Luma
                and enabled for managed Zcash checkout.
              </p>
            </div>
          ) : null}

          {data.events.length === 0 ? (
            <div className="home-empty-state">
              <h3>No public events yet</h3>
              <p>
                No public Zcash-enabled events are currently available for this
                organizer.
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
                    ) : (
                      <span>{eventInitials(event.name)}</span>
                    )}
                  </div>
                  <div className="public-event-row-copy">
                    <p className="console-kpi-label">Upcoming event</p>
                    <h3>{event.name}</h3>
                    <p className="subtle-text">
                      {eventDateLabel(
                        event.start_at,
                        event.timezone || undefined,
                      )}
                      {event.location_label
                        ? ` · ${event.location_label}`
                        : " · Luma event"}
                    </p>
                    <span className="public-inline-link">
                      Managed Zcash checkout
                    </span>
                  </div>
                  <span className="public-row-action">Get tickets</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {embedMode && data.calendar.embed_show_branding ? (
          <EmbedBrandingFooter />
        ) : null}
      </div>
    </main>
  );
}
