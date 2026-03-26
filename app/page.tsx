export const runtime = "nodejs";

const heroChoices = [
  {
    label: "Self-serve",
    title: "CipherPay-only ticketing",
    description:
      "Create events, ticket tiers, and hosted Zcash checkout directly in the CipherPay dashboard.",
  },
  {
    label: "Managed",
    title: "Luma + CipherPay integration",
    description:
      "Keep Luma as the system of record for event operations while ZecTix adds a managed Zcash checkout option.",
  },
] as const;

const ticketingOptions = [
  {
    label: "Direct path",
    title: "CipherPay-only ticketing",
    description:
      "Run Zcash-native ticket sales straight from CipherPay when you want the shortest route to hosted checkout, direct settlement, and a privacy-forward buyer flow.",
    bullets: [
      "Create events, ticket tiers, capacities, and checkout links from the CipherPay dashboard.",
      "Use hosted Zcash checkout with QR codes, wallet payment URIs, and direct-to-wallet settlement.",
      "Avoid layering in a separate event-platform subscription just to sell tickets for Zcash.",
    ],
    primaryHref: "https://www.cipherpay.app/en/dashboard/login",
    primaryLabel: "Open CipherPay dashboard",
    secondaryHref: "https://www.cipherpay.app/",
    secondaryLabel: "Learn about CipherPay",
  },
  {
    label: "Managed path",
    title: "Luma + CipherPay",
    description:
      "Add Zcash to an existing Luma workflow without asking the organizer to abandon Luma pages, guests, approvals, reminders, or check-in.",
    bullets: [
      "Keep Luma as the source of truth for event publishing, approvals, guest records, and day-of-event workflows.",
      "Mirror only supported tickets into a Zcash-ready public surface powered by CipherPay settlement.",
      "Use this path when the organizer already depends on Luma and wants Zcash beside the existing checkout story.",
    ],
    primaryHref: "#luma-managed",
    primaryLabel: "See the managed flow",
    secondaryHref: "#why-zectix",
    secondaryLabel: "Why this path exists",
  },
] as const;

const cipherPayOrganizerFlow = [
  {
    title: "Create the event and ticket tiers in CipherPay.",
    description:
      "CipherPay’s event tooling can define ticket names, pricing, capacities, and the checkout link that buyers will use.",
  },
  {
    title: "Share a hosted Zcash checkout page.",
    description:
      "The buyer lands on a purpose-built payment page with QR code, wallet URI, and invoice state handled by CipherPay.",
  },
  {
    title: "Track detection, webhooks, and check-in from the same product.",
    description:
      "CipherPay handles fast payment detection, confirmation updates, webhook delivery, and event-side follow-up tools.",
  },
] as const;

const cipherPayBuyerFlow = [
  {
    title: "Open the event checkout and choose the ticket.",
    description:
      "The direct CipherPay path keeps the buyer on a native Zcash payment flow rather than routing through another event platform first.",
  },
  {
    title: "Pay from a Zcash wallet using shielded checkout.",
    description:
      "The hosted page presents the QR code and URI, and CipherPay watches the mempool and chain for the payment.",
  },
  {
    title: "See payment state update quickly.",
    description:
      "CipherPay documents fast mempool detection, later confirmation, and webhook or dashboard updates for the merchant side.",
  },
] as const;

const lumaContinuity = [
  {
    title: "Event publishing and pages stay in Luma.",
    description:
      "Organizers still create events, manage descriptions, and keep the canonical event page in the product their community already knows.",
  },
  {
    title: "Guest records, approvals, reminders, and check-in stay put.",
    description:
      "The managed path is designed for teams that want Zcash without giving up Luma’s attendee workflows or event-day tooling.",
  },
  {
    title: "ZecTix only layers in the Zcash checkout surface.",
    description:
      "The public ticketing surface, sync rules, and registration handoff are managed so the organizer does not need to build the glue themselves.",
  },
] as const;

const lumaManagedFlow = [
  {
    title: "Connect Luma and CipherPay.",
    description:
      "You keep both accounts under your control, and ZecTix connects them for the beta without replacing your existing event workflow.",
  },
  {
    title: "Mirror only the events and tickets that qualify.",
    description:
      "Supported inventory is synced from Luma into a public Zcash-ready surface so only the right tickets are offered through this path.",
  },
  {
    title: "Attach the attendee back into Luma after payment.",
    description:
      "CipherPay handles invoice creation and payment state, and ZecTix moves the attendee back into Luma so your normal operations stay intact.",
  },
] as const;

const platformNotes = [
  {
    title: "Start with the path that fits your event stack",
    description:
      "Some organizers want direct Zcash-native ticketing right away, while others want to add Zcash without moving off Luma. This beta supports both.",
  },
  {
    title: "Private payments, organizer-owned settlement",
    description:
      "Both options keep Zcash checkout and organizer-controlled CipherPay settlement at the center of the buyer experience.",
  },
  {
    title: "Initial no-cost trial for early partners",
    description:
      "ZecTix is opening as an early beta with an initial no-cost trial so organizers can test the fit before the product expands further.",
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
            <a href="#ticketing-paths">Ticketing paths</a>
            <a href="#cipherpay-events">CipherPay-only</a>
            <a href="#luma-managed">Luma + CipherPay</a>
            <a href="#why-zectix">Why ZecTix</a>
          </div>
        </nav>

        <section className="card home-hero">
          <div className="home-hero-grid hub-hero-grid">
            <div className="home-hero-copy">
              <p className="home-badge">Early beta</p>
              <h1 className="home-display">
                One home for Zcash ticketing, with two paths live today.
              </h1>
              <p className="home-lede">
                ZecTix now gives organizers one place to choose between direct
                CipherPay ticketing and a managed Luma + CipherPay integration.
                Both keep Zcash settlement front and center, and both are being
                introduced through an initial no-cost beta for early organizers
                who want to test private Zcash payments in real event flows.
              </p>
              <div className="home-actions">
                <a className="button" href="#ticketing-paths">
                  Compare the paths
                </a>
                <a
                  className="button button-secondary"
                  href="https://www.cipherpay.app/en/dashboard/login"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open CipherPay dashboard
                </a>
              </div>
              <div className="public-chip-row">
                <span className="public-chip">CipherPay-only ticketing</span>
                <span className="public-chip">Luma + CipherPay</span>
                <span className="public-chip">Organizer-owned settlement</span>
                <span className="public-chip">Initial no-cost beta</span>
              </div>

              <article className="home-summary-card home-summary-wide">
                <div className="home-summary-grid">
                  <div className="home-summary-item">
                    <span>Direct path</span>
                    <strong>
                      Native CipherPay events, hosted checkout, and direct-to-wallet Zcash settlement.
                    </strong>
                  </div>
                  <div className="home-summary-item">
                    <span>Managed path</span>
                    <strong>
                      Luma remains the system of record while ZecTix layers in managed Zcash checkout.
                    </strong>
                  </div>
                  <div className="home-summary-item">
                    <span>Beta offer</span>
                    <strong>
                      Early organizers can try the product now through a no-cost beta while the ZecTix ticketing hub continues to expand.
                    </strong>
                  </div>
                </div>
              </article>
            </div>

            <div className="home-hero-panel">
              <article className="home-panel-card">
                <p className="home-panel-label">Available in beta</p>
                <div className="hub-choice-list">
                  {heroChoices.map((choice) => (
                    <div className="hub-choice-card" key={choice.title}>
                      <p className="hub-choice-kicker">{choice.label}</p>
                      <h3>{choice.title}</h3>
                      <p>{choice.description}</p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="home-panel-card">
                <p className="home-panel-label">How to think about the split</p>
                <p className="home-panel-inline">
                  <span className="home-inline-dot" />
                  Use direct CipherPay when you want a Zcash-native ticketing
                  surface with hosted checkout and no extra event-platform layer
                  in the way.
                </p>
                <p className="home-panel-inline">
                  <span className="home-inline-dot" />
                  Use managed Luma + CipherPay when the organizer already runs
                  event operations in Luma and wants Zcash to sit beside that
                  existing workflow.
                </p>
                <p className="home-panel-inline">
                  <span className="home-inline-dot" />
                  Join through the early beta now, then choose the path that
                  best matches your event stack and operational needs.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="home-events-section" id="ticketing-paths">
          <div className="home-section-heading">
            <p className="eyebrow">Ticketing paths</p>
            <h2 className="home-display">
              Choose the Zcash ticketing path that matches how you want to run
              events.
            </h2>
            <p className="subtle-text">
              Today that means a direct CipherPay route and a managed Luma +
              CipherPay route. Both are available as part of the current
              early-access beta, with room for more Zcash ticketing paths to
              join over time.
            </p>
          </div>

          <div className="ticketing-option-grid">
            {ticketingOptions.map((option) => (
              <article className="ticketing-option-card" key={option.title}>
                <p className="ticketing-option-label">{option.label}</p>
                <h3>{option.title}</h3>
                <p className="ticketing-option-description">{option.description}</p>

                <div className="ticketing-option-list">
                  {option.bullets.map((bullet) => (
                    <div className="ticketing-option-point" key={bullet}>
                      <span className="ticketing-option-dot" />
                      <p>{bullet}</p>
                    </div>
                  ))}
                </div>

                <div className="ticketing-option-actions">
                  <a
                    className="button"
                    href={option.primaryHref}
                    {...(option.primaryHref.startsWith("http")
                      ? { target: "_blank", rel: "noreferrer" }
                      : {})}
                  >
                    {option.primaryLabel}
                  </a>
                  <a
                    className="button button-secondary"
                    href={option.secondaryHref}
                    {...(option.secondaryHref.startsWith("http")
                      ? { target: "_blank", rel: "noreferrer" }
                      : {})}
                  >
                    {option.secondaryLabel}
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="card marketing-spotlight" id="cipherpay-events">
          <div className="marketing-spotlight-header">
            <div className="marketing-spotlight-copy">
              <p className="home-badge">CipherPay-only</p>
              <h2 className="marketing-spotlight-title home-display">
                Direct Zcash ticketing through the CipherPay dashboard.
              </h2>
              <p className="home-lede">
                CipherPay now has its own event and ticketing flow, so an
                organizer can create ticket tiers, generate checkout links, accept
                shielded Zcash, and manage the event from the CipherPay side
                without routing the event through Luma.
              </p>
              <div className="home-actions">
                <a
                  className="button"
                  href="https://www.cipherpay.app/en/dashboard/login"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open CipherPay dashboard
                </a>
                <a
                  className="button button-ghost"
                  href="https://testnet.cipherpay.app/en/docs"
                  target="_blank"
                  rel="noreferrer"
                >
                  Read CipherPay docs
                </a>
              </div>
            </div>

            <aside className="marketing-spotlight-side">
              <div className="marketing-note">
                <strong>Why choose this path</strong>
                <p>
                  Use direct CipherPay when privacy-forward Zcash checkout is the
                  product, and you do not need Luma&apos;s event-management layer
                  in the middle. It is the cleanest way to start testing
                  Zcash-only ticket sales during the beta.
                </p>
              </div>

              <div className="marketing-spotlight-surface">
                <p className="marketing-surface-label">CipherPay capabilities</p>
                <div className="marketing-spotlight-pills">
                  <span className="public-chip">Hosted ticket checkout</span>
                  <span className="public-chip">Ticket tiers and capacity</span>
                  <span className="public-chip">Fast detection + webhooks</span>
                </div>
              </div>
            </aside>
          </div>

          <div className="marketing-spotlight-steps">
            <article className="home-panel-card">
              <p className="home-panel-label">Organizer flow</p>
              <div className="home-flow-list">
                {cipherPayOrganizerFlow.map((item, index) => (
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
              <p className="home-panel-label">Buyer flow</p>
              <div className="home-flow-list">
                {cipherPayBuyerFlow.map((item, index) => (
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

        <section className="home-events-section" id="luma-managed">
          <div className="ops-fit-layout hub-split-layout">
            <div className="home-section-heading ops-fit-heading">
              <p className="eyebrow">Luma + CipherPay</p>
              <h2 className="home-display">
                Keep Luma in charge of event operations and add Zcash where it fits.
              </h2>
              <p className="subtle-text">
                The managed ZecTix path is for organizers who already rely on
                Luma for publishing, approvals, reminders, guest management,
                and check-in, but want selected tickets to expose a Zcash
                option through CipherPay. It is a good fit for early partners
                who want to pilot Zcash payments without replatforming their
                event stack.
              </p>
            </div>

            <div className="ops-fit-grid hub-luma-grid">
              {lumaContinuity.map((item, index) => (
                <article
                  className={`marketing-proof-card ops-fit-card${
                    index === lumaContinuity.length - 1 ? " ops-fit-card-wide" : ""
                  }`}
                  key={item.title}
                >
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="hub-flow-grid">
            {lumaManagedFlow.map((item, index) => (
              <article className="marketing-feature-card hub-flow-card" key={item.title}>
                <p className="marketing-card-kicker">Step {index + 1}</p>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="home-events-section" id="why-zectix">
          <div className="home-section-heading">
            <p className="eyebrow">Why ZecTix</p>
            <h2 className="home-display">
              A single Zcash ticketing home is more useful than a one-size-fits-all
              product story.
            </h2>
            <p className="subtle-text">
              Some organizers want direct Zcash-native ticketing. Others want
              Zcash to live alongside an existing event platform. ZecTix is
              opening with an initial no-cost beta that supports both cleanly,
              and it can make room for additional approaches over time.
            </p>
          </div>

          <div className="marketing-proof-grid">
            {platformNotes.map((item) => (
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
