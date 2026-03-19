import Link from "next/link";
import { listLumaEvents } from "@/lib/luma";
import { getRuntimeConfig } from "@/lib/test-harness/state";

type EventFetchResult =
  | {
      status: "success";
      events: Awaited<ReturnType<typeof listLumaEvents>>;
    }
  | { status: "missing-key"; message: string }
  | { status: "error"; message: string };

async function getEvents(): Promise<EventFetchResult> {
  const config = await getRuntimeConfig({ allowMissingTable: true });
  const apiKey = config.luma_api_key;

  if (!apiKey) {
    return {
      status: "missing-key",
      message: "Add your Luma API key on the Test Admin page to load the upcoming events feed.",
    };
  }

  try {
    const now = Date.now();
    const events = (await listLumaEvents(apiKey))
      .filter((event) => new Date(event.start_at).getTime() > now)
      .sort(
        (left, right) =>
          new Date(left.start_at).getTime() - new Date(right.start_at).getTime(),
      );
    return { status: "success", events };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Unable to reach the Luma API right now.",
    };
  }
}

function eventDateLabel(value: string, timeZone = "America/New_York") {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
}

function eventLocationLabel(value: string | null) {
  return value || "Luma event";
}

function EventListMessage({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="home-empty-state">
      <h3>{title}</h3>
      <p>{message}</p>
      <p>
        The app defaults to local DynamoDB at <code>http://127.0.0.1:8000</code>.
        Start DynamoDB Local if it is not already running, run{" "}
        <code>npm run db:init</code> once, then save your Luma and CipherPay
        keys on the <code>/admin</code> page.
      </p>
      <Link
        href="/admin"
        className="button"
      >
        Open admin
      </Link>
    </div>
  );
}

export const EventList = async () => {
  const result = await getEvents();

  if (result.status === "missing-key") {
    return (
      <EventListMessage
        title="Connect your Luma API key"
        message={result.message}
      />
    );
  }

  if (result.status === "error") {
    return (
      <EventListMessage
        title="We couldn't load events yet"
        message={result.message}
      />
    );
  }

  if (result.events.length === 0) {
    return (
      <EventListMessage
        title="No events returned"
        message="The API request succeeded, but this calendar does not have any upcoming events right now."
      />
    );
  }

  const { events } = result;
  const [featuredEvent, ...otherEvents] = events;

  return (
    <div className="public-event-feed">
      <Link
        href={`/events/${encodeURIComponent(featuredEvent.api_id)}`}
        className="public-feature-card"
      >
        <div className="public-feature-media">
          {featuredEvent.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={featuredEvent.name}
              className="public-feature-image"
              src={featuredEvent.cover_url}
            />
          ) : (
            <span className="public-feature-mark">Z</span>
          )}
        </div>
        <div className="public-feature-copy">
          <p className="public-feature-kicker">Featured event</p>
          <h3>{featuredEvent.name}</h3>
          <p className="subtle-text">
            {eventDateLabel(featuredEvent.start_at)} ·{" "}
            {eventLocationLabel(featuredEvent.location_label)}
          </p>
          <div className="public-chip-row">
            <span className="public-chip">Pay in ZEC</span>
            <span className="public-chip">Instant confirmation</span>
            <span className="public-chip">Luma ticket delivery</span>
          </div>
        </div>
      </Link>

      <div className="public-event-list">
        {events.map((event) => (
          <Link
            className="public-event-row"
            href={`/events/${encodeURIComponent(event.api_id)}`}
            key={event.api_id}
          >
            <div className="public-event-icon">
              {event.cover_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={event.name}
                  className="public-event-icon-image"
                  src={event.cover_url}
                />
              ) : (
                <span>Z</span>
              )}
            </div>
            <div className="public-event-row-copy">
              <h3>{event.name}</h3>
              <p className="subtle-text">
                {eventDateLabel(event.start_at)} ·{" "}
                {eventLocationLabel(event.location_label)}
              </p>
              {event.url ? (
                <span className="public-inline-link">Available on Luma after registration</span>
              ) : null}
            </div>
            <span className="public-row-action">
              {event.api_id === featuredEvent.api_id && otherEvents.length === 0
                ? "Open event"
                : "Get tickets"}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
};
