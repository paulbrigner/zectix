import Link from "next/link";
import { EventList } from "@/components/EventList";

export function HomePage() {
  return (
    <div className="home-shell">
      <main className="home-main">
        <section className="home-hero card">
          <div className="home-hero-grid">
            <div className="home-hero-copy">
              <p className="home-badge">Luma + CipherPay + Zcash</p>
              <h1 className="home-display">
                Accept Zcash for event registrations without leaving your app.
              </h1>
              <p className="home-lede">
                LumaZcash is a local test integration that creates CipherPay
                invoices for Luma events, renders an in-app payment flow, and
                tracks registration state from payment through attendee ticket
                delivery.
              </p>

              <div className="home-actions">
                <a className="button" href="#upcoming-events">
                  Browse upcoming events
                </a>
                <Link className="button button-secondary" href="/dashboard">
                  Open dashboard
                </Link>
                <Link className="button button-ghost" href="/admin">
                  Configure integration
                </Link>
              </div>
            </div>

            <aside className="home-hero-panel">
              <div className="home-panel-card">
                <p className="home-panel-label">What This App Does</p>
                <div className="home-flow-list">
                  <div className="home-flow-item">
                    <span className="home-flow-step">1</span>
                    <div>
                      <strong>Create a Luma-backed checkout session</strong>
                      <p>Pull event and ticket pricing from Luma, then create the matching CipherPay invoice.</p>
                    </div>
                  </div>
                  <div className="home-flow-item">
                    <span className="home-flow-step">2</span>
                    <div>
                      <strong>Collect Zcash through CipherPay</strong>
                      <p>Show the buyer a native payment screen with QR, payment URI, and live status updates.</p>
                    </div>
                  </div>
                  <div className="home-flow-item">
                    <span className="home-flow-step">3</span>
                    <div>
                      <strong>Confirm the Luma registration outcome</strong>
                      <p>Persist local state, inspect webhooks, and verify the final attendee pass in one place.</p>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </div>

          <div className="home-summary-card home-summary-wide">
            <div className="home-summary-grid">
              <article className="home-summary-item">
                <span>Checkout</span>
                <strong>In-app Zcash QR, URI, and wallet deep link</strong>
              </article>
              <article className="home-summary-item">
                <span>Registration</span>
                <strong>Luma guest creation after CipherPay acceptance</strong>
              </article>
              <article className="home-summary-item">
                <span>Ops</span>
                <strong>Local dashboard, webhook logs, and admin config</strong>
              </article>
            </div>
          </div>
        </section>

        <section className="home-events-section" id="upcoming-events">
          <div className="home-section-heading">
            <h2 className="home-display">Start from a live Luma event.</h2>
            <p className="subtle-text">
              Choose an upcoming event to create a CipherPay invoice and walk
              through the complete Zcash purchase and registration flow.
            </p>
            <p className="eyebrow">Upcoming Events</p>
          </div>

          <EventList />
        </section>
      </main>
    </div>
  );
}
