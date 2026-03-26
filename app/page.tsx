export const runtime = "nodejs";

const externalLinkProps = {
  rel: "noreferrer",
  target: "_blank",
} as const;

const ticketPaths = [
  {
    variant: "direct",
    label: "CipherPay direct",
    title: "Sell tickets directly through CipherPay.",
    preview:
      "Use CipherPay itself as the ticketing and checkout layer when you want a pure Zcash flow.",
    description:
      "Best when you want enhanced privacy, no extra third-party subscription layer, and a straightforward merchant-owned Zcash checkout.",
    highlights: [
      "Hosted checkout with QR code and payment address",
      "Invoice or product creation through the dashboard, API, or product pages",
      "Dashboard visibility plus webhook updates as payment is detected and confirmed",
    ],
    primaryAction: {
      href: "https://www.cipherpay.app/en/dashboard/login",
      label: "Open CipherPay dashboard",
    },
    secondaryAction: {
      href: "https://www.cipherpay.app/",
      label: "Learn about CipherPay",
    },
  },
  {
    variant: "managed",
    label: "Luma + CipherPay",
    title: "Add Zcash to a Luma-based event stack.",
    preview:
      "Keep Luma in charge of event operations while ZecTix adds a managed Zcash path.",
    description:
      "Best when your event pages, guest records, approvals, reminders, and check-in already live in Luma and you want Zcash alongside the existing flow.",
    highlights: [
      "Mirror only supported Luma inventory into public Zcash checkout",
      "Attach accepted attendees back into Luma after payment",
      "Use the managed service layer for sync, webhook visibility, and recovery",
    ],
    primaryAction: {
      href: "#luma-managed",
      label: "See the managed flow",
    },
    secondaryAction: {
      href: "#managed-fit",
      label: "Why this path is managed",
    },
  },
] as const;

const directCipherPayFlow = [
  {
    title: "Create the ticket or invoice in CipherPay.",
    description:
      "CipherPay's docs describe invoice creation through the dashboard, API, or product pages, which makes the direct path workable for Zcash-native ticket sales.",
  },
  {
    title: "Send buyers to CipherPay's hosted checkout.",
    description:
      "The buyer sees a QR code and payment address, then pays shielded ZEC from their wallet through CipherPay's hosted checkout surface.",
  },
  {
    title: "Watch dashboard and webhook status updates.",
    description:
      "CipherPay detects payments quickly, later marks them confirmed, and updates both the merchant dashboard and webhook stream so fulfillment can continue.",
  },
] as const;

const directCipherPayNotes = [
  "You want a Zcash-first ticket flow without a separate event-management platform in the middle.",
  "You want hosted checkout, webhook updates, and merchant-owned settlement directly to your own wallet.",
  "You want the shortest path from ticket listing to shielded Zcash payment.",
] as const;

const lumaContinuity = [
  {
    title: "Event publishing and pages",
    description:
      "Organizers still create events, manage details, and keep the canonical event experience in Luma.",
  },
  {
    title: "Guest and attendee records",
    description:
      "Accepted buyers are attached back into Luma so teams can keep using familiar guest-management workflows.",
  },
  {
    title: "Approvals, reminders, and check-in",
    description:
      "The day-of-event and attendee-lifecycle tools remain where organizers already expect them to be.",
  },
] as const;

const organizerFlow = [
  {
    title: "Connect Luma and CipherPay",
    description:
      "The organizer keeps their own accounts. ZecTix just wires them together as a managed service layer.",
  },
  {
    title: "Mirror only the events and tickets that qualify",
    description:
      "Supported inventory is synced from Luma into a public Zcash-ready surface without relying on live global config.",
  },
  {
    title: "Accept payment and attach the attendee back into Luma",
    description:
      "CipherPay handles invoice creation and webhooks, while ZecTix advances the registration workflow automatically.",
  },
] as const;

const managedOperationalNotes = [
  {
    title: "Ticket-by-ticket control",
    description:
      "Only mirrored tickets that pass automatic checks and operator assertions are exposed to public Zcash checkout.",
  },
  {
    title: "Observable webhook handling",
    description:
      "Webhook deliveries, retryable registration tasks, and recovery paths stay visible to the service team during pilots.",
  },
  {
    title: "Future organizer dashboard",
    description:
      "The current service-manager workflow is laying the groundwork for a tenant-facing organizer dashboard later on.",
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
            <a href="#options">Options</a>
            <a href="#cipherpay-direct">CipherPay direct</a>
            <a href="#luma-managed">Luma + CipherPay</a>
          </div>
        </nav>

        <section className="card home-hero">
          <div className="home-hero-grid">
            <div className="home-hero-copy">
              <p className="home-badge">One home for Zcash ticketing</p>
              <h1 className="home-display">
                Two live ways to sell tickets for Zcash today.
              </h1>
              <p className="home-lede">
                Start directly in CipherPay when you want a Zcash-native ticket
                flow with enhanced privacy and no extra third-party subscription
                layer. Choose the managed Luma + CipherPay path when you want to
                preserve Luma as the system of record for event operations and
                add Zcash selectively.
              </p>
              <div className="home-actions">
                <a className="button" href="#options">
                  Compare ticketing paths
                </a>
                <a
                  className="button button-secondary"
                  href="https://www.cipherpay.app/en/dashboard/login"
                  {...externalLinkProps}
                >
                  Open CipherPay dashboard
                </a>
              </div>
              <div className="public-chip-row">
                <span className="public-chip">CipherPay direct ticketing</span>
                <span className="public-chip">Managed Luma + CipherPay</span>
                <span className="public-chip">Privacy-forward checkout</span>
                <span className="public-chip">More paths coming</span>
              </div>

              <article className="home-summary-card home-summary-wide">
                <div className="home-summary-grid">
                  <div className="home-summary-item">
                    <span>Direct path</span>
                    <strong>
                      Hosted CipherPay checkout with dashboard control and
                      merchant-owned settlement.
                    </strong>
                  </div>
                  <div className="home-summary-item">
                    <span>Managed path</span>
                    <strong>
                      Mirrored Luma inventory with attendee attachment back into
                      Luma after payment.
                    </strong>
                  </div>
                  <div className="home-summary-item">
                    <span>This homepage</span>
                    <strong>
                      A single starting point for current and future Zcash
                      ticketing options.
                    </strong>
                  </div>
                </div>
              </article>
            </div>

            <div className="home-hero-panel">
              {ticketPaths.map((path) => (
                <article
                  className={`home-panel-card hub-preview-card hub-preview-card-${path.variant}`}
                  key={path.title}
                >
                  <p className="home-panel-label">{path.label}</p>
                  <h2 className="hub-preview-title">{path.title}</h2>
                  <p className="hub-preview-copy">{path.preview}</p>
                  <a
                    className={`button ${
                      path.variant === "direct" ? "button-secondary" : "button-ghost"
                    }`}
                    href={path.primaryAction.href}
                    {...(path.variant === "direct" ? externalLinkProps : {})}
                  >
                    {path.primaryAction.label}
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="home-events-section" id="options">
          <div className="home-section-heading">
            <p className="eyebrow">Current options</p>
            <h2 className="home-display">
              Choose the Zcash ticketing path that matches your stack today.
            </h2>
            <p className="subtle-text">
              ZecTix is no longer just one integration story. It is the landing
              point for the Zcash ticketing paths that are available now, with
              room to add more later.
            </p>
          </div>

          <div className="ticket-path-grid">
            {ticketPaths.map((path) => (
              <article
                className={`ticket-path-card ticket-path-card-${path.variant}`}
                id={path.variant === "managed" ? undefined : "cipherpay-option"}
                key={path.title}
              >
                <p className="ticket-path-label">{path.label}</p>
                <h3>{path.title}</h3>
                <p>{path.description}</p>
                <ul className="ticket-path-list">
                  {path.highlights.map((highlight) => (
                    <li key={highlight}>{highlight}</li>
                  ))}
                </ul>
                <div className="ticket-path-actions">
                  <a
                    className="button"
                    href={path.primaryAction.href}
                    {...(path.variant === "direct" ? externalLinkProps : {})}
                  >
                    {path.primaryAction.label}
                  </a>
                  <a
                    className={`button ${
                      path.variant === "direct" ? "button-ghost" : "button-secondary"
                    }`}
                    href={path.secondaryAction.href}
                    {...(path.variant === "direct" ? externalLinkProps : {})}
                  >
                    {path.secondaryAction.label}
                  </a>
                </div>
                {path.variant === "direct" ? (
                  <a
                    className="ticket-path-inline-link"
                    href="https://testnet.cipherpay.app/en/docs"
                    {...externalLinkProps}
                  >
                    Read CipherPay docs
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <section
          className="home-events-section cipherpay-direct-section"
          id="cipherpay-direct"
        >
          <div className="cipherpay-direct-layout">
            <div className="home-section-heading cipherpay-direct-heading">
              <p className="eyebrow">CipherPay direct</p>
              <h2 className="home-display">
                Use CipherPay itself as the ticketing and checkout layer.
              </h2>
              <p className="subtle-text">
                CipherPay&apos;s documented flow is straightforward: create an
                invoice through the dashboard, API, or product pages; send the
                buyer to a hosted checkout; then watch dashboard and webhook
                updates as payment is detected and later confirmed. For teams
                that do not need Luma, that makes CipherPay the cleanest Zcash
                ticketing path on this page.
              </p>
              <div className="home-actions">
                <a
                  className="button"
                  href="https://www.cipherpay.app/en/dashboard/login"
                  {...externalLinkProps}
                >
                  Open CipherPay dashboard
                </a>
                <a
                  className="button button-secondary"
                  href="https://www.cipherpay.app/"
                  {...externalLinkProps}
                >
                  CipherPay home
                </a>
              </div>
            </div>

            <aside className="cipherpay-direct-aside">
              <p className="marketing-card-kicker">Good fit when</p>
              <div className="cipherpay-direct-points">
                {directCipherPayNotes.map((note) => (
                  <p key={note}>{note}</p>
                ))}
              </div>
              <a
                className="cipherpay-direct-link"
                href="https://testnet.cipherpay.app/en/docs"
                {...externalLinkProps}
              >
                Review CipherPay docs
              </a>
            </aside>
          </div>

          <div className="marketing-feature-grid cipherpay-flow-grid">
            {directCipherPayFlow.map((step, index) => (
              <article className="marketing-feature-card" key={step.title}>
                <p className="marketing-card-kicker">Step {index + 1}</p>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="card marketing-spotlight" id="luma-managed">
          <div className="marketing-spotlight-header">
            <div className="marketing-spotlight-copy">
              <p className="home-badge">Managed Luma + CipherPay</p>
              <h2 className="marketing-spotlight-title home-display">
                Keep Luma in charge and add Zcash where it makes sense.
              </h2>
              <p className="home-lede">
                This is the managed-service path ZecTix is building today.
                Supported Luma inventory is mirrored into a public Zcash checkout,
                and accepted attendees attach back into Luma so organizers keep
                their existing event, guest, approval, reminder, and check-in
                workflows.
              </p>
            </div>

            <aside className="marketing-spotlight-side">
              <div className="marketing-note">
                <strong>Best when</strong>
                <p>
                  Your team already runs the event in Luma and wants Zcash as an
                  additional checkout path, not a replacement for Luma.
                </p>
              </div>

              <div className="marketing-spotlight-surface">
                <p className="marketing-surface-label">Managed path characteristics</p>
                <div className="marketing-spotlight-pills">
                  <span className="public-chip">Mirrored Luma inventory</span>
                  <span className="public-chip">Organizer-owned CipherPay</span>
                  <span className="public-chip">Automatic attendee attachment</span>
                </div>
              </div>
            </aside>
          </div>

          <div className="marketing-spotlight-steps">
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
              <p className="home-panel-label">Managed flow</p>
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
          </div>
        </section>

        <section
          className="home-events-section ops-fit-section"
          id="managed-fit"
        >
          <div className="ops-fit-layout">
            <div className="home-section-heading ops-fit-heading">
              <p className="eyebrow">Managed-service fit</p>
              <h2 className="home-display">
                Why the Luma path is operator-led today.
              </h2>
              <p className="subtle-text">
                Unlike the direct CipherPay path, the managed Luma integration
                mirrors inventory, enforces ticket eligibility, tracks webhooks,
                and retries attendee attachment back into Luma. That additional
                surface area is why the service manager currently handles the
                operational layer.
              </p>
            </div>

            <div className="ops-fit-grid">
              {managedOperationalNotes.map((item, index) => (
                <article
                  className={`marketing-proof-card ops-fit-card${
                    index === managedOperationalNotes.length - 1
                      ? " ops-fit-card-wide"
                      : ""
                  }`}
                  key={item.title}
                >
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
