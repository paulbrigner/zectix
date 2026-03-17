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

  return (
    <div className="home-event-grid">
      {events.map((event) => (
        <Link
          href={`/events/${encodeURIComponent(event.api_id)}`}
          className="home-event-card"
          key={event.api_id}
        >
          <div className="home-event-card-inner">
            {event.cover_url && (
              <div className="home-event-media">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={event.cover_url}
                  alt={event.name}
                  className="home-event-image"
                />
              </div>
            )}
            <div className="home-event-copy">
              <div className="home-event-meta">
                <span className="home-event-tag">Luma event</span>
                <span className="home-event-tag home-event-tag-accent">
                  Zcash enabled
                </span>
              </div>
              <h3>{event.name}</h3>
              <p className="home-event-date">
                {new Date(event.start_at).toLocaleString(undefined, {
                  month: "long",
                  day: "numeric",
                  timeZone: "America/New_York",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
              <div className="home-event-footer">
                <span className="home-event-action">
                  Create CipherPay checkout
                </span>
                {event.url ? (
                  <span className="home-event-hint">
                    Luma event remains available after registration
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
};
