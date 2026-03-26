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
}: {
  params: Promise<{ calendarSlug: string }>;
}) {
  const { calendarSlug } = await params;
  const data = await getPublicCalendar(calendarSlug);
  if (!data) {
    notFound();
  }

  return (
    <main className="public-home-shell">
      <div className="public-home-main">
        <div className="public-home-topbar">
          <div className="public-brand">
            <span>{data.tenant.name}</span>
          </div>
          <Link className="button button-secondary button-small" href="/">
            Service home
          </Link>
        </div>

        <section className="public-events-section">
          <div className="public-section-heading">
            <p className="eyebrow">Public calendar</p>
            <h1 className="public-display">Upcoming events</h1>
            <p className="subtle-text">
              {data.calendar.display_name} events that were mirrored from Luma and enabled for managed Zcash checkout.
            </p>
          </div>

          {data.events.length === 0 ? (
            <div className="home-empty-state">
              <h3>No public events yet</h3>
              <p>
                No public Zcash-enabled events are currently available for this organizer.
              </p>
            </div>
          ) : (
            <div className="public-event-list">
              {data.events.map((event) => (
                <Link
                  className="public-event-row"
                  href={`/c/${encodeURIComponent(data.calendar.slug)}/events/${encodeURIComponent(event.event_api_id)}`}
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
                      {eventDateLabel(event.start_at, event.timezone || undefined)}
                      {event.location_label ? ` · ${event.location_label}` : " · Luma event"}
                    </p>
                    <span className="public-inline-link">Managed Zcash checkout</span>
                  </div>
                  <span className="public-row-action">Get tickets</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
