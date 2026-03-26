export const runtime = "nodejs";

const coreBenefits = [
  {
    label: "Private Zcash payments",
    title: "Give attendees a privacy-forward payment option.",
    description:
      "Offer a pay-with-Zcash path for supported tickets without asking organizers to abandon the event stack they already trust.",
  },
  {
    label: "Dual payment paths",
    title: "Run Luma's normal checkout alongside Zcash.",
    description:
      "Organizers can keep their standard Luma payment path live while selectively enabling Zcash on the tickets that make sense.",
  },
  {
    label: "Luma stays in charge",
    title: "Keep Luma's pages, guests, approvals, reminders, and check-in intact.",
    description:
      "ZecTix adds payment plumbing and mirrored checkout surfaces, but Luma remains the system of record for event management and attendee operations.",
  },
  {
    label: "Organizer-owned settlement",
    title: "Funds land through the organizer's own CipherPay account.",
    description:
      "Invoices are created with organizer-controlled CipherPay credentials, so the service does not become a custody layer.",
  },
  {
    label: "Fast acceptance",
    title: "Future-event purchases can move as soon as payment is detected.",
    description:
      "For scheduled events, the attendee experience does not need to wait around for the full confirmation window before moving forward.",
  },
  {
    label: "Managed rollout",
    title: "Pilot safely with operator controls behind the scenes.",
    description:
      "Syncs, ticket eligibility, webhook health, retries, and recovery tooling stay in the service layer while the public flow stays simple.",
  },
] as const;

const lumaContinuity = [
  {
    title: "Event publishing and pages",
    description: "Organizers still create events, manage details, and keep the canonical event experience in Luma.",
  },
  {
    title: "Guest and attendee records",
    description: "Accepted buyers are attached back into Luma so teams can keep using familiar guest-management workflows.",
  },
  {
    title: "Approvals, reminders, and check-in",
    description: "The day-of-event and attendee-lifecycle tools remain where organizers already expect them to be.",
  },
] as const;

const organizerFlow = [
  {
    title: "Connect Luma and CipherPay",
    description: "The organizer keeps their own accounts. ZecTix just wires them together as a managed service layer.",
  },
  {
    title: "Mirror only the events and tickets that qualify",
    description: "Supported inventory is synced from Luma into a public Zcash-ready surface without relying on live global config.",
  },
  {
    title: "Accept payment and attach the attendee back into Luma",
    description: "CipherPay handles invoice creation and webhooks, while ZecTix advances the registration workflow automatically.",
  },
] as const;

const operationalNotes = [
  {
    title: "Ticket-by-ticket control",
    description: "Only mirrored tickets that pass automatic checks and operator assertions are exposed to public Zcash checkout.",
  },
  {
    title: "Observable webhook handling",
    description: "Webhook deliveries, retryable registration tasks, and recovery paths stay visible to the service team during pilots.",
  },
  {
    title: "Designed for future organizer access",
    description: "The current service-manager workflow is laying the groundwork for a tenant-facing organizer dashboard later on.",
  },
] as const;

export default function Home() {
  return (
    <main className="home-shell">
      <div className="home-main">
        <nav className="public-home-topbar">
          <div className="public-brand">
            <span>ZecTix</span>
          </div>
          <div className="public-home-nav-links">
            <a href="#why-zectix">Why ZecTix</a>
            <a href="#product-flow">How it works</a>
            <a href="#ops-readiness">Operational fit</a>
          </div>
        </nav>

        <section className="card home-hero">
          <div className="home-hero-grid">
            <div className="home-hero-copy">
              <p className="home-badge">Managed Luma + Zcash checkout</p>
              <h1 className="home-display">
                Private Zcash payments for Luma events, without replacing Luma.
              </h1>
              <p className="home-lede">
                ZecTix adds a managed Zcash path alongside normal Luma payment
                flows. Organizers keep their event pages, ticketing rules,
                approvals, reminders, guest records, and check-in workflows in
                Luma while settlement stays in their own CipherPay account.
              </p>
              <div className="home-actions">
                <a className="button" href="#product-flow">
                  See the product flow
                </a>
                <a className="button button-secondary" href="#why-zectix">
                  Why organizers use it
                </a>
              </div>
              <div className="public-chip-row">
                <span className="public-chip">Private payment option</span>
                <span className="public-chip">Dual Luma or Zcash paths</span>
                <span className="public-chip">Organizer-owned CipherPay</span>
                <span className="public-chip">Luma remains the system of record</span>
              </div>

              <article className="home-summary-card home-summary-wide">
                <div className="home-summary-grid">
                  <div className="home-summary-item">
                    <span>Checkout model</span>
                    <strong>
                      Add a Zcash path without turning off the organizer&apos;s
                      existing Luma flow.
                    </strong>
                  </div>
                  <div className="home-summary-item">
                    <span>Ops model</span>
                    <strong>
                      Managed-service rollout now, with a reusable tenant surface
                      for organizer access later.
                    </strong>
                  </div>
                  <div className="home-summary-item">
                    <span>Settlement</span>
                    <strong>
                      Organizer-controlled CipherPay invoices instead of a shared
                      service wallet.
                    </strong>
                  </div>
                </div>
              </article>
            </div>

            <div className="home-hero-panel">
              <article className="home-panel-card">
                <p className="home-panel-label">What stays in Luma</p>
                <div className="home-flow-list">
                  {lumaContinuity.map((item, index) => (
                    <div className="home-flow-item" key={item.title}>
                      <span className="home-flow-step">{index + 1}</span>
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="home-panel-card">
                <p className="home-panel-label">Why this fits event operations</p>
                <p className="home-panel-inline">
                  <span className="home-inline-dot" />
                  Zcash becomes an additional checkout option, not a replacement
                  for the organizer&apos;s existing event machinery.
                </p>
                <p className="home-panel-inline">
                  <span className="home-inline-dot" />
                  Public pages can expose supported tickets while leaving the rest
                  of Luma&apos;s event management model intact.
                </p>
                <p className="home-panel-inline">
                  <span className="home-inline-dot" />
                  The service layer handles sync, webhook tracking, and recovery
                  work so pilots stay manageable.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="home-events-section" id="why-zectix">
          <div className="home-section-heading">
            <p className="eyebrow">Why ZecTix</p>
            <h2 className="home-display">
              Keep the Luma experience people already know and add a private
              payment option where it actually matters.
            </h2>
            <p className="subtle-text">
              ZecTix is designed for organizers who want privacy-friendly payment
              acceptance without rebuilding their ticketing, attendance, or guest
              management stack.
            </p>
          </div>

          <div className="marketing-feature-grid">
            {coreBenefits.map((benefit) => (
              <article className="marketing-feature-card" key={benefit.title}>
                <p className="marketing-card-kicker">{benefit.label}</p>
                <h3>{benefit.title}</h3>
                <p>{benefit.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="card marketing-spotlight" id="product-flow">
          <div className="home-hero-grid">
            <div className="marketing-spotlight-copy">
              <p className="home-badge">How it works</p>
              <h2 className="marketing-spotlight-title home-display">
                A managed Zcash checkout layered onto mirrored Luma inventory.
              </h2>
              <p className="home-lede">
                Supported tickets are mirrored from the organizer&apos;s Luma calendar,
                buyers choose pay with Zcash, and the attendee is attached back
                into Luma after payment is detected.
              </p>
              <div className="marketing-note">
                <strong>Dual-path by design</strong>
                <p>
                  The goal is not to replace Luma. It is to let organizers keep
                  using Luma while offering Zcash wherever that extra option
                  creates value.
                </p>
              </div>
            </div>

            <div className="home-hero-panel">
              <article className="home-panel-card">
                <p className="home-panel-label">Organizer flow</p>
                <div className="home-flow-list">
                  {organizerFlow.map((item, index) => (
                    <div className="home-flow-item" key={item.title}>
                      <span className="home-flow-step">{index + 1}</span>
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="home-panel-card">
                <p className="home-panel-label">Attendee experience</p>
                <div className="home-flow-list">
                  <div className="home-flow-item">
                    <span className="home-flow-step">1</span>
                    <div>
                      <strong>Choose a supported event and ticket.</strong>
                      <p>
                        The public page only shows mirrored inventory that has been
                        explicitly enabled for managed Zcash checkout.
                      </p>
                    </div>
                  </div>
                  <div className="home-flow-item">
                    <span className="home-flow-step">2</span>
                    <div>
                      <strong>Pay with Zcash through CipherPay.</strong>
                      <p>
                        The attendee sees a purpose-built checkout flow instead of
                        a generic operator console surface.
                      </p>
                    </div>
                  </div>
                  <div className="home-flow-item">
                    <span className="home-flow-step">3</span>
                    <div>
                      <strong>Get attached back into the Luma event.</strong>
                      <p>
                        Once payment is accepted, the system advances registration
                        and keeps the organizer&apos;s attendee operations anchored in
                        Luma.
                      </p>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="home-events-section" id="ops-readiness">
          <div className="home-section-heading">
            <p className="eyebrow">Operational fit</p>
            <h2 className="home-display">
              Built for pilots now, with the service controls needed to make the
              rollout credible.
            </h2>
            <p className="subtle-text">
              The public experience stays streamlined while the operator side
              handles sync, assertions, webhook visibility, registration retries,
              and recovery when real-world edge cases show up.
            </p>
          </div>

          <div className="marketing-proof-grid">
            {operationalNotes.map((item) => (
              <article className="marketing-proof-card" key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
