import Link from "next/link";
import type { CSSProperties } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { EmbedFrameBridge } from "@/components/EmbedFrameBridge";
import { CheckoutStatusCard } from "@/components/CheckoutStatusCard";
import {
  getCalendarConnection,
  getEventMirror,
  getSession,
} from "@/lib/app-state/state";
import {
  buildEmbedThemeStyle,
  isCalendarEmbedEnabled,
  resolveEmbedParentOrigin,
} from "@/lib/embed";
import { isSessionViewerTokenValid } from "@/lib/session-viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{
    t?: string;
    embed?: string;
    et?: string;
    po?: string;
  }>;
}) {
  const { sessionId } = await params;
  const { t, embed, et, po } = await searchParams;
  const session = await getSession(sessionId);
  if (!session) {
    notFound();
  }

  if (
    !isSessionViewerTokenValid(
      session.session_id,
      session.attendee_email,
      t || null,
    )
  ) {
    notFound();
  }

  const [event, calendar] = await Promise.all([
    getEventMirror(session.calendar_connection_id, session.event_api_id),
    getCalendarConnection(session.calendar_connection_id),
  ]);
  const embedMode = embed === "1";
  let embedParentOrigin: string | null = null;

  if (embedMode) {
    if (!calendar || !isCalendarEmbedEnabled(calendar)) {
      notFound();
    }

    const requestHeaders = await headers();
    embedParentOrigin = resolveEmbedParentOrigin({
      calendarConnectionId: calendar.calendar_connection_id,
      allowedOrigins: calendar.embed_allowed_origins,
      requestHeaders,
      parentToken: et || null,
      parentOriginHint: po || null,
    });
    if (!embedParentOrigin) {
      notFound();
    }
  }

  const pageStyle =
    embedMode && calendar
      ? (buildEmbedThemeStyle(calendar.embed_theme) as CSSProperties)
      : undefined;

  return (
    <main
      className={`page checkout-shell${embedMode ? " embed-page-shell" : ""}`}
      style={pageStyle}
    >
      {embedMode ? (
        <EmbedFrameBridge
          calendarSlug={session.public_calendar_slug}
          enabled
          parentOrigin={embedParentOrigin}
          sessionId={session.session_id}
          view="checkout"
        />
      ) : null}
      <section
        className={`card event-page-card${embedMode ? " embed-page-card" : ""}`}
      >
        {!embedMode || calendar?.embed_show_branding ? (
          <div
            className={`event-page-topbar${embedMode ? " embed-page-topbar" : ""}`}
          >
            <div className="public-brand">
              <span>
                {calendar?.display_name || session.public_calendar_slug}
              </span>
            </div>
            {!embedMode ? (
              <div className="event-page-actions">
                {event?.url ? (
                  <a
                    className="button button-secondary button-small"
                    href={event.url}
                    rel="noreferrer noopener"
                    target="_blank"
                  >
                    Open on Luma
                  </a>
                ) : null}
                <Link
                  className="button button-secondary button-small"
                  href={`/c/${encodeURIComponent(session.public_calendar_slug)}`}
                >
                  Back to calendar
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="status-page-heading">
          {!embedMode ? <p className="eyebrow">Checkout</p> : null}
          <h1>{session.event_name}</h1>
          <p className="subtle-text">Ticket for {session.attendee_name}</p>
        </div>

        <CheckoutStatusCard
          embedMode={embedMode}
          event={event}
          initialSession={session}
          viewerToken={t || null}
        />
      </section>
    </main>
  );
}
