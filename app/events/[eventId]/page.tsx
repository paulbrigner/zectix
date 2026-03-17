import Link from "next/link";
import { notFound } from "next/navigation";
import { EventCheckoutForm } from "@/components/EventCheckoutForm";
import { getLumaEventById, listLumaTicketTypes } from "@/lib/luma";
import { getRuntimeConfig } from "@/lib/test-harness/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function eventDateLabel(value: string, timeZone = "America/New_York") {
  return new Date(value).toLocaleString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const config = await getRuntimeConfig({ allowMissingTable: true });

  if (!config.luma_api_key) {
    return (
      <main className="page checkout-shell">
        <section className="card checkout-card">
          <p className="eyebrow">Setup required</p>
          <h1>Save your Luma API key first</h1>
          <p className="subtle-text">
            This event checkout flow loads the event and final registration from
            Luma. Save your local test settings on the admin page, then reopen
            this event.
          </p>
          <div className="button-row">
            <Link className="button" href="/admin">
              Open admin
            </Link>
            <Link className="button button-secondary" href="/">
              Back home
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const event = await getLumaEventById(config.luma_api_key, eventId);
  if (!event) {
    notFound();
  }

  const ticketTypes = await listLumaTicketTypes(config.luma_api_key, event.api_id).catch(
    () => [],
  );
  const hasPricedTicket = ticketTypes.some(
    (ticket) => ticket.amount != null && Boolean(ticket.currency),
  );
  const checkoutEnabled = Boolean(config.api_key && config.luma_api_key && hasPricedTicket);
  const disabledReason = !config.api_key
    ? "Add your CipherPay API key on the Test Admin page before creating a checkout."
    : !hasPricedTicket
      ? "This event needs at least one active Luma ticket type with a fixed price before CipherPay checkout can be created."
      : null;

  return (
    <main className="page checkout-shell">
      <section className="card checkout-card">
        <div className="checkout-hero">
          <div className="checkout-hero-header">
            <div>
              <p className="eyebrow">Event checkout</p>
            </div>
            <div className="checkout-hero-actions">
              {event.url ? (
                <a
                  className="button button-secondary button-small"
                  href={event.url}
                  rel="noreferrer noopener"
                  target="_blank"
                >
                  Open Luma event
                </a>
              ) : null}
              <Link className="button button-secondary button-small" href="/dashboard">
                Open dashboard
              </Link>
              <Link className="button button-secondary button-small" href="/">
                Back home
              </Link>
            </div>
          </div>

          <div className="checkout-hero-body">
            <div className="checkout-hero-copy">
              <div className="checkout-hero-lead">
                {event.cover_url ? (
                  <div className="checkout-hero-media">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      alt={event.name}
                      className="checkout-hero-image"
                      src={event.cover_url}
                    />
                  </div>
                ) : null}
                <div className="checkout-hero-lead-copy">
                  <h1>{event.name}</h1>
                  <p className="subtle-text">
                    Create a CipherPay invoice, pay directly from the QR code or
                    wallet link in this app, then let the local flow finish the Luma
                    registration after the payment is accepted.
                  </p>
                </div>
              </div>
              <div className="checkout-hero-meta">
                <span>Starts {eventDateLabel(event.start_at, event.timezone || undefined)}</span>
                {event.end_at ? (
                  <span>Ends {eventDateLabel(event.end_at, event.timezone || undefined)}</span>
                ) : null}
                <span>{event.timezone || "America/New_York"}</span>
                {event.location_label ? <span>{event.location_label}</span> : null}
              </div>
              {event.location_note ? (
                <p className="checkout-hero-detail subtle-text">{event.location_note}</p>
              ) : null}
              {event.description ? (
                <p className="checkout-hero-detail subtle-text">{event.description}</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="checkout-layout">
          <section className="checkout-main-card">
            <EventCheckoutForm
              checkoutEnabled={checkoutEnabled}
              disabledReason={disabledReason}
              eventApiId={event.api_id}
              ticketTypes={ticketTypes}
            />
          </section>

          <aside className="checkout-sidebar">
            <section className="checkout-sidebar-card">
              <h2>How this flow works</h2>
              <div className="checkout-flow-list">
                <div className="checkout-flow-item">
                  <span className="checkout-flow-bullet" />
                  <div>
                    <strong>Create the invoice</strong>
                    <p>Choose a Luma ticket and generate the matching CipherPay invoice in this app.</p>
                  </div>
                </div>
                <div className="checkout-flow-item">
                  <span className="checkout-flow-bullet" />
                  <div>
                    <strong>Pay with Zcash</strong>
                    <p>Use the in-app QR code, payment address, or wallet deep link to send the payment.</p>
                  </div>
                </div>
                <div className="checkout-flow-item">
                  <span className="checkout-flow-bullet" />
                  <div>
                    <strong>Stay on the status page</strong>
                    <p>Keep the checkout open while CipherPay detects the payment and the attendee pass is prepared.</p>
                  </div>
                </div>
                <div className="checkout-flow-item">
                  <span className="checkout-flow-bullet" />
                  <div>
                    <strong>Finish registration</strong>
                    <p>Once payment is accepted, the app creates the Luma guest registration and shows the entry QR here.</p>
                  </div>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}
