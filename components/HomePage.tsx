import { EventList } from "@/components/EventList";

export function HomePage() {
  return (
    <div className="public-home-shell">
      <main className="public-home-main">
        <nav className="public-home-topbar">
          <div className="public-brand">
            <span>ZecTix</span>
          </div>
          <div className="public-home-nav-links">
            <a href="#upcoming-events">Events</a>
          </div>
        </nav>

        <section className="public-events-section" id="upcoming-events">
          <div className="public-section-heading">
            <p className="eyebrow">Upcoming events</p>
            <h2 className="public-display">Upcoming events</h2>
            <p className="subtle-text">
              Choose an event, select a ticket, and continue straight into the
              Zcash payment flow.
            </p>
          </div>
          <EventList />
        </section>
      </main>
    </div>
  );
}
