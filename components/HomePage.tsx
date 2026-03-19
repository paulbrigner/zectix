import { EventList } from "@/components/EventList";

export function HomePage() {
  return (
    <div className="public-home-shell">
      <main className="public-home-main">
        <section className="public-home-hero card">
          <nav className="public-home-nav">
            <div className="public-brand">
              <span className="public-brand-badge">Z</span>
              <span>LumaZcash</span>
            </div>
            <div className="public-home-nav-links">
              <a href="#upcoming-events">Events</a>
            </div>
          </nav>

          <div className="public-home-hero-grid">
            <div className="public-home-copy">
              <p className="eyebrow">Upcoming events</p>
              <h1 className="public-display">Buy Luma event tickets with Zcash.</h1>
              <p className="public-home-lede">
                Browse upcoming Luma events, choose a ticket, and finish
                payment in one flow.
              </p>
              <div className="public-chip-row">
                <span className="public-chip">In-app checkout</span>
                <span className="public-chip">CipherPay payment</span>
                <span className="public-chip">Luma ticket delivery</span>
              </div>
              <div className="public-home-actions">
                <a className="button" href="#upcoming-events">
                  Browse events
                </a>
              </div>
            </div>

            <aside className="public-home-panel">
              <p className="public-panel-label">What this app does</p>
              <div className="public-panel-list">
                <article className="public-panel-item">
                  <span className="public-panel-step">1</span>
                  <div>
                    <strong>Load live Luma events and ticket options</strong>
                    <p>Choose an event, pick a ticket, and start checkout from the same flow.</p>
                  </div>
                </article>
                <article className="public-panel-item">
                  <span className="public-panel-step">2</span>
                  <div>
                    <strong>Pay with a native Zcash checkout screen</strong>
                    <p>Use the QR code, wallet deep link, or copied address to complete payment.</p>
                  </div>
                </article>
                <article className="public-panel-item">
                  <span className="public-panel-step">3</span>
                  <div>
                    <strong>Receive the Luma pass after payment</strong>
                    <p>Track status in-app and hand off to Luma for the attendee ticket and calendar invite.</p>
                  </div>
                </article>
              </div>
            </aside>
          </div>
        </section>

        <section className="public-events-section" id="upcoming-events">
          <div className="public-section-heading">
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
