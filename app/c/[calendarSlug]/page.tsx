import Link from "next/link";
import { notFound } from "next/navigation";
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

export default async function PublicCalendarPage({
  params,
}: {
  params: Promise<{ calendarSlug: string }>;
}) {
  const { calendarSlug } = await params;
  const data = await getPublicCalendar(calendarSlug);
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
          <Link className="button button-secondary button-small" href="/">
            Service home
          </Link>
        </div>

        <div className="event-page-hero">
          <div className="event-page-copy">
            <p className="eyebrow">Public calendar</p>
            <h1>{data.calendar.display_name}</h1>
            <p className="subtle-text">
              Tickets below were mirrored from Luma and explicitly enabled for managed Zcash checkout.
            </p>
          </div>
        </div>

        <section className="console-section">
          {data.events.length === 0 ? (
            <p className="subtle-text">
              No public Zcash-enabled events are currently available for this organizer.
            </p>
          ) : (
            <div className="public-event-list">
              {data.events.map((event) => (
                <Link
                  className="public-event-row"
                  href={`/c/${encodeURIComponent(data.calendar.slug)}/events/${encodeURIComponent(event.event_api_id)}`}
                  key={event.event_api_id}
                >
                  <div className="public-event-row-copy">
                    <h3>{event.name}</h3>
                    <p className="subtle-text">
                      {eventDateLabel(event.start_at, event.timezone || undefined)}
                      {event.location_label ? ` · ${event.location_label}` : ""}
                    </p>
                  </div>
                  <span className="public-row-action">Pay with Zcash</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
