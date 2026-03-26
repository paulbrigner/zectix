import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckoutStatusCard } from "@/components/CheckoutStatusCard";
import { getEventMirror, getSession } from "@/lib/app-state/state";
import { isSessionViewerTokenValid } from "@/lib/session-viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { sessionId } = await params;
  const { t } = await searchParams;
  const session = await getSession(sessionId);
  if (!session) {
    notFound();
  }

  if (!isSessionViewerTokenValid(session.session_id, session.attendee_email, t || null)) {
    notFound();
  }

  const event = await getEventMirror(session.calendar_connection_id, session.event_api_id);

  return (
    <main className="page checkout-shell">
      <section className="card event-page-card">
        <div className="event-page-topbar">
          <div className="public-brand">
            <span>{session.public_calendar_slug}</span>
          </div>
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
        </div>

        <div className="status-page-heading">
          <p className="eyebrow">Checkout</p>
          <h1>{session.event_name}</h1>
          <p className="subtle-text">Ticket for {session.attendee_name}</p>
        </div>

        <CheckoutStatusCard
          event={event}
          initialSession={session}
          viewerToken={t || null}
        />
      </section>
    </main>
  );
}
