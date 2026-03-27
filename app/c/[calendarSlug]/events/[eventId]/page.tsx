import Link from "next/link";
import { notFound } from "next/navigation";
import { EventCheckoutForm } from "@/components/EventCheckoutForm";
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
}: {
  params: Promise<{ calendarSlug: string; eventId: string }>;
}) {
  const { calendarSlug, eventId } = await params;
  const data = await getPublicEventPageData(calendarSlug, eventId);
  if (!data) {
    notFound();
  }

  return (
    <main className="page checkout-shell">
      <section className="card event-page-card">
        <div className="event-page-topbar">
          <div className="public-brand">
            <span>{data.tenant.name}</span>
          </div>
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
        </div>

        <div className="event-page-hero">
          <div className="event-page-lead">
            {data.event.cover_url ? (
              <div className="event-page-media">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt={data.event.name} className="event-page-image" src={data.event.cover_url} />
              </div>
            ) : null}

            <div className="event-page-copy">
              <p className="eyebrow">Managed checkout</p>
              <h1>{data.event.name}</h1>
              <p className="subtle-text">
                {eventDateLabel(data.event.start_at, data.event.timezone || undefined)}
                {data.event.location_label ? ` · ${data.event.location_label}` : ""}
              </p>
              {data.event.description ? (
                <p className="event-page-detail subtle-text">{data.event.description}</p>
              ) : null}
            </div>
          </div>
        </div>

        <section className="event-page-form-shell">
          <EventCheckoutForm
            calendarSlug={data.calendar.slug}
            eventApiId={data.event.event_api_id}
            ticketTypes={data.tickets}
            unavailableTicketTypes={data.unavailable_tickets}
          />
        </section>
      </section>
    </main>
  );
}
