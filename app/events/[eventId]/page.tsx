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
            Save your Luma API key on the admin page, then reopen this event to
            load the live ticket options.
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
      <section className="card event-page-card">
        <div className="event-page-topbar">
          <div className="public-brand">
            <span className="public-brand-badge">Z</span>
            <span>LumaZcash</span>
          </div>
          <div className="event-page-actions">
            {event.url ? (
              <a
                className="button button-secondary button-small"
                href={event.url}
                rel="noreferrer noopener"
                target="_blank"
              >
                Open on Luma
              </a>
            ) : null}
            <Link className="button button-secondary button-small" href="/">
              Back to events
            </Link>
          </div>
        </div>

        <div className="event-page-hero">
          <div className="event-page-lead">
            {event.cover_url ? (
              <div className="event-page-media">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={event.name}
                  className="event-page-image"
                  src={event.cover_url}
                />
              </div>
            ) : null}

            <div className="event-page-copy">
              <p className="eyebrow">Event checkout</p>
              <h1>{event.name}</h1>
              <p className="event-page-lede subtle-text">
                Choose a ticket and enter the attendee details Luma needs for
                registration.
              </p>
            </div>
          </div>

          <div className="event-page-chips">
            <span>Starts {eventDateLabel(event.start_at, event.timezone || undefined)}</span>
            {event.location_label ? <span>{event.location_label}</span> : null}
            <span>Email ticket delivery</span>
          </div>

          {event.end_at || event.timezone ? (
            <div className="event-page-detail-row subtle-text">
              {event.end_at ? (
                <span>Ends {eventDateLabel(event.end_at, event.timezone || undefined)}</span>
              ) : null}
              {event.timezone ? <span>{event.timezone}</span> : null}
            </div>
          ) : null}

          {event.location_note ? (
            <p className="event-page-detail subtle-text">{event.location_note}</p>
          ) : null}
          {event.description ? (
            <p className="event-page-detail subtle-text">{event.description}</p>
          ) : null}
        </div>

        <section className="event-page-form-shell">
          <EventCheckoutForm
            checkoutEnabled={checkoutEnabled}
            disabledReason={disabledReason}
            eventApiId={event.api_id}
            ticketTypes={ticketTypes}
          />
        </section>
      </section>
    </main>
  );
}
