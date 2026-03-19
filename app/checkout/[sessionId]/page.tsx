import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckoutStatusCard } from "@/components/CheckoutStatusCard";
import { getLumaEventById } from "@/lib/luma";
import { getRuntimeConfig, getSession } from "@/lib/app-state/state";
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

  if (!isSessionViewerTokenValid(session.session_id, session.attendee_email, t)) {
    notFound();
  }

  const config = await getRuntimeConfig({ allowMissingTable: true });
  const event = config.luma_api_key
    ? await getLumaEventById(config.luma_api_key, session.event_api_id).catch(
        () => null,
      )
    : null;

  return (
    <main className="page checkout-shell">
      <section className="card event-page-card">
        <div className="event-page-topbar">
          <div className="public-brand">
            <span>LumaZcash</span>
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
              href={`/events/${encodeURIComponent(session.event_api_id)}`}
            >
              Back to event
            </Link>
          </div>
        </div>

        <div className="status-page-heading">
          <p className="eyebrow">Checkout</p>
          <h1>{session.event_name}</h1>
          <p className="subtle-text">Ticket for {session.attendee_name}</p>
        </div>

        <CheckoutStatusCard
          initialSession={session}
          event={event}
          lumaEventUrl={event?.url || null}
          viewerToken={t || null}
        />
      </section>
    </main>
  );
}
