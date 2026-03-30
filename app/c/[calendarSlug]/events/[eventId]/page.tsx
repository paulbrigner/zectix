import Link from "next/link";
import type { CSSProperties } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { EmbedBrandingFooter } from "@/components/EmbedBrandingFooter";
import { EmbedFrameBridge } from "@/components/EmbedFrameBridge";
import { EventCheckoutForm } from "@/components/EventCheckoutForm";
import {
  buildEmbedThemeStyle,
  createEmbedParentToken,
  isCalendarEmbedEnabled,
  resolveEmbedParentOrigin,
} from "@/lib/embed";
import { getPublicEventPageData } from "@/lib/public/public-calendars";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function eventDateLabel(value: string, timeZone = "America/New_York") {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "full",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}

export default async function PublicEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ calendarSlug: string; eventId: string }>;
  searchParams: Promise<{ embed?: string; et?: string; po?: string }>;
}) {
  const { calendarSlug, eventId } = await params;
  const resolvedSearchParams = await searchParams;
  const data = await getPublicEventPageData(calendarSlug, eventId);
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

  return (
    <main
      className={`page checkout-shell${embedMode ? " embed-page-shell" : ""}`}
      style={pageStyle}
    >
      {embedMode ? (
        <EmbedFrameBridge
          calendarSlug={data.calendar.slug}
          enabled
          eventId={data.event.event_api_id}
          parentOrigin={embedParentOrigin}
          view="event"
        />
      ) : null}
      <section
        className={`card event-page-card${embedMode ? " embed-page-card" : ""}`}
      >
        {!embedMode ? (
          <div
            className={`event-page-topbar${embedMode ? " embed-page-topbar" : ""}`}
          >
            <div className="public-brand">
              <span>
                {embedMode ? data.calendar.display_name : data.tenant.name}
              </span>
            </div>
            {!embedMode ? (
              <div className="button-row">
                <Link
                  className="button button-secondary button-small"
                  href={`/c/${encodeURIComponent(data.calendar.slug)}`}
                >
                  Back to calendar
                </Link>
                {data.event.url ? (
                  <a
                    className="button button-secondary button-small"
                    href={data.event.url}
                    rel="noreferrer noopener"
                    target="_blank"
                  >
                    Open on Luma
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="event-page-hero">
          <div className="event-page-lead">
            {data.event.cover_url ? (
              <div className="event-page-media">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={data.event.name}
                  className="event-page-image"
                  src={data.event.cover_url}
                />
              </div>
            ) : null}

            <div className="event-page-copy">
              <h1>{data.event.name}</h1>
              <p className="subtle-text">
                {eventDateLabel(
                  data.event.start_at,
                  data.event.timezone || undefined,
                )}
                {data.event.location_label
                  ? ` · ${data.event.location_label}`
                  : ""}
              </p>
              {data.event.description ? (
                <p className="event-page-detail subtle-text">
                  {data.event.description}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <section className="event-page-form-shell">
          <EventCheckoutForm
            calendarSlug={data.calendar.slug}
            embedMode={embedMode}
            embedParentOrigin={embedParentOrigin}
            embedParentToken={embedParentToken}
            eventApiId={data.event.event_api_id}
            ticketTypes={data.tickets}
          />
        </section>

        {embedMode && data.calendar.embed_show_branding ? (
          <EmbedBrandingFooter />
        ) : null}
      </section>
    </main>
  );
}
