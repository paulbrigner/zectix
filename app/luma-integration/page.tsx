import Link from "next/link";
import { HeroGlow } from "@/components/HeroGlow";
import { LumaIntegrationChecklist } from "@/components/LumaIntegrationChecklist";

export const runtime = "nodejs";

const nextSteps = [
  {
    label: "Confirm the requirements",
    description:
      "Review the billing disclosures, technical setup requirements, and supported ticket restrictions for the managed path.",
  },
  {
    label: "Connect your accounts",
    description:
      "Continue into the organizer dashboard to connect CipherPay, add your Luma credentials, and validate the calendar you want to mirror.",
  },
  {
    label: "Review and publish",
    description:
      "Mirror eligible events, keep unsupported inventory hidden, and enable public checkout only where it is ready.",
  },
] as const;

export default function LumaIntegrationPage() {
  return (
    <main className="landing">
      <HeroGlow />
      <nav className="landing-nav">
        <Link className="landing-wordmark landing-wordmark-link" href="/">
          ZecTix
        </Link>
        <div className="landing-nav-links">
          <Link href="/">Home</Link>
          <Link href="/#direct">Direct</Link>
          <Link href="/#managed">Luma</Link>
          <Link href="/#why">Why ZecTix</Link>
        </div>
      </nav>

      <section className="landing-hero landing-interest-hero">
        <p className="landing-badge">Managed path</p>
        <h1 className="landing-headline">
          Get started with the
          <br />
          ZecTix Luma integration.
        </h1>
        <p className="landing-sub">
          Confirm the managed checkout requirements for your organization, then
          continue straight into self-serve onboarding for Luma-based Zcash
          checkout.
        </p>
      </section>

      <section className="landing-section landing-interest-section">
        <div className="landing-interest-layout">
          <div className="landing-interest-overview">
            <div className="landing-interest-card">
              <p className="landing-label">What happens next</p>
              <h2 className="landing-section-title landing-interest-title">
                Review once, then onboard directly.
              </h2>
              <p className="landing-section-desc">
                This path no longer starts with a waitlist form. If you already
                have the required accounts and your supported ticket tiers fit
                the mirrored checkout model, you can confirm the checklist and
                move straight into dashboard setup.
              </p>

              <div className="landing-steps landing-interest-steps">
                {nextSteps.map((step, index) => (
                  <div className="landing-step" key={step.label}>
                    <span className="landing-step-num">{`0${index + 1}`}</span>
                    <div>
                      <h3 className="landing-step-title">{step.label}</h3>
                      <p className="landing-step-desc">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="landing-interest-side-note">
              <p className="landing-path-label">Good fit</p>
              <p className="landing-path-desc">
                This works best for organizers who already run public,
                fixed-price Luma events and want to add managed Zcash checkout
                without changing their event pages or guest workflows.
              </p>
            </div>
          </div>

          <LumaIntegrationChecklist />
        </div>
      </section>

      <footer className="landing-footer">
        <span className="landing-wordmark">ZecTix</span>
        <p>Built on Zcash</p>
      </footer>
    </main>
  );
}
