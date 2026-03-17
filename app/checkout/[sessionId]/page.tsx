import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckoutStatusCard } from "@/components/CheckoutStatusCard";
import { getLumaEventById } from "@/lib/luma";
import { getRuntimeConfig, getSession } from "@/lib/test-harness/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const session = await getSession(sessionId);

  if (!session) {
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
      <section className="card checkout-card">
        <div className="checkout-page-header">
          <div>
            <p className="eyebrow">Live checkout status</p>
            <h1>Registration for {session.attendee_name}</h1>
          </div>
          <div className="button-row">
            <Link className="button button-secondary" href="/dashboard">
              Dashboard
            </Link>
            <Link
              className="button button-secondary"
              href={`/events/${encodeURIComponent(session.event_api_id)}`}
            >
              Event page
            </Link>
          </div>
        </div>

        <CheckoutStatusCard
          initialSession={session}
          event={event}
          lumaEventUrl={event?.url || null}
        />
      </section>
    </main>
  );
}
