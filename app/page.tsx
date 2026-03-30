import { Button } from "@/components/ui";
import { HeroGlow } from "@/components/HeroGlow";

export const runtime = "nodejs";

const directSteps = [
  {
    number: "01",
    title: "Create your event",
    description:
      "Set up ticket tiers, pricing, and capacity in the CipherPay dashboard.",
  },
  {
    number: "02",
    title: "Share the checkout link",
    description:
      "Buyers land on a hosted Zcash payment page with QR code and wallet URI.",
  },
  {
    number: "03",
    title: "Get paid directly",
    description:
      "Zcash goes straight to your wallet. Track payments and check-in from the dashboard.",
  },
] as const;

const managedSteps = [
  {
    number: "01",
    title: "Connect your accounts",
    description:
      "Link your Luma calendar and CipherPay wallet. You keep both under your control.",
  },
  {
    number: "02",
    title: "Mirror your tickets",
    description:
      "Eligible tickets sync into a Zcash checkout surface. Only supported tiers are offered.",
  },
  {
    number: "03",
    title: "Sell and register",
    description:
      "Attendees pay with Zcash and land back in Luma automatically. Your normal operations stay intact.",
  },
] as const;

const reasons = [
  {
    title: "Private by default",
    description:
      "Zcash shielded transactions keep buyer payment data private. No payment surveillance, no data harvesting.",
  },
  {
    title: "Direct settlement",
    description:
      "Funds go straight to the organizer's wallet. No platform holds your money, no withdrawal delays.",
  },
  {
    title: "No buyer accounts",
    description:
      "Attendees don't need to create accounts or hand over personal data to buy a ticket.",
  },
  {
    title: "Free during beta",
    description:
      "ZecTix is in early beta with a no-cost trial for organizers who want to test private Zcash payments in real event flows.",
  },
] as const;

export default function Home() {
  return (
    <main className="landing">
      <HeroGlow />
      <nav className="landing-nav">
        <span className="landing-wordmark">ZecTix</span>
        <div className="landing-nav-links">
          <a href="#paths">Paths</a>
          <a href="#direct">Direct</a>
          <a href="#managed">Luma</a>
          <a href="#why">Why ZecTix</a>
        </div>
        <div className="landing-nav-actions">
          <Button
            variant="landing-ghost"
            href="https://www.cipherpay.app/en/dashboard/login"
            target="_blank"
            rel="noreferrer"
          >
            CipherPay login
          </Button>
          <Button variant="landing-ghost" href="/dashboard/login">
            ZecTix login
          </Button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="landing-hero">
        <p className="landing-badge">Early beta</p>
        <h1 className="landing-headline">
          Private ticketing,
          <br />
          powered by Zcash.
        </h1>
        <p className="landing-sub">
          Sell event tickets with shielded Zcash payments. Direct-to-wallet
          settlement, no middleman, no buyer accounts required.
        </p>
        <div className="landing-hero-actions">
          <Button variant="landing-primary" href="#paths">
            Get started
          </Button>
          <Button variant="landing-ghost" href="#why">
            Why ZecTix
          </Button>
        </div>
      </section>

      {/* ── Paths ── */}
      <section className="landing-section" id="paths">
        <p className="landing-label">Two paths</p>
        <h2 className="landing-section-title">
          Choose how you want to run events.
        </h2>
        <p className="landing-section-desc">
          Both paths use CipherPay for Zcash payment processing and
          direct-to-wallet settlement.
        </p>

        <div className="landing-paths">
          <a className="landing-path-card" href="#direct">
            <span className="landing-path-label">Direct</span>
            <h3 className="landing-path-title">Zcash-native ticketing</h3>
            <p className="landing-path-desc">
              Create events, set ticket tiers, and sell directly with Zcash.
              Hosted checkout with QR codes and wallet URIs. No extra platforms
              in the way.
            </p>
            <span className="landing-path-cta">
              How it works<span aria-hidden="true"> &rarr;</span>
            </span>
          </a>

          <a className="landing-path-card" href="#managed">
            <span className="landing-path-label">Managed</span>
            <h3 className="landing-path-title">Luma integration</h3>
            <p className="landing-path-desc">
              Already using Luma? Keep it for event pages, guest records,
              approvals, reminders, and check-in. ZecTix adds Zcash checkout
              alongside your existing workflow.
            </p>
            <span className="landing-path-cta">
              How it works<span aria-hidden="true"> &rarr;</span>
            </span>
          </a>
        </div>
      </section>

      {/* ── Direct flow ── */}
      <section className="landing-section" id="direct">
        <p className="landing-label">Direct path</p>
        <h2 className="landing-section-title">
          Zcash-native ticketing through CipherPay.
        </h2>

        <div className="landing-steps">
          {directSteps.map((s) => (
            <div className="landing-step" key={s.number}>
              <span className="landing-step-num">{s.number}</span>
              <div>
                <h3 className="landing-step-title">{s.title}</h3>
                <p className="landing-step-desc">{s.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="landing-section-actions">
          <Button
            variant="landing-primary"
            href="https://www.cipherpay.app/en/dashboard/login"
            target="_blank"
            rel="noreferrer"
          >
            Get started with CipherPay
          </Button>
          <Button
            variant="landing-ghost"
            href="https://testnet.cipherpay.app/en/docs"
            target="_blank"
            rel="noreferrer"
          >
            CipherPay docs
          </Button>
        </div>
      </section>

      {/* ── Managed flow ── */}
      <section className="landing-section" id="managed">
        <p className="landing-label">Managed path</p>
        <h2 className="landing-section-title">
          Add Zcash checkout to your Luma events.
        </h2>

        <div className="landing-steps">
          {managedSteps.map((s) => (
            <div className="landing-step" key={s.number}>
              <span className="landing-step-num">{s.number}</span>
              <div>
                <h3 className="landing-step-title">{s.title}</h3>
                <p className="landing-step-desc">{s.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="landing-section-actions">
          <Button variant="landing-primary" href="/luma-integration">
            Get started with the ZecTix Luma integration
          </Button>
          <Button
            variant="landing-ghost"
            href="https://zectix.com/c/pgpforcrypto"
            target="_blank"
            rel="noreferrer"
          >
            Try the demo
          </Button>
        </div>
      </section>

      {/* ── Why ── */}
      <section className="landing-section" id="why">
        <p className="landing-label">Why ZecTix</p>
        <h2 className="landing-section-title">
          Private payments for real events.
        </h2>

        <div className="landing-reasons">
          {reasons.map((r) => (
            <div className="landing-reason" key={r.title}>
              <h3 className="landing-reason-title">{r.title}</h3>
              <p className="landing-reason-desc">{r.description}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="landing-footer">
        <span className="landing-wordmark">ZecTix</span>
        <p>Built on Zcash</p>
      </footer>
    </main>
  );
}
