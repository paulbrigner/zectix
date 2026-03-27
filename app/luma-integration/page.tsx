import Link from "next/link";
import { HeroGlow } from "@/components/HeroGlow";
import { LumaIntegrationInterestForm } from "@/components/LumaIntegrationInterestForm";

export const runtime = "nodejs";

const nextSteps = [
  {
    label: "Tell us about your setup",
    description:
      "Share how you use Luma today, the kinds of events you run, and what you want from a Zcash checkout path.",
  },
  {
    label: "We review fit and logistics",
    description:
      "We’ll look at event shape, ticket structure, and whether the current integration path is a good match.",
  },
  {
    label: "We follow up directly",
    description:
      "If it looks like a fit, we’ll reach out about next steps for the early beta and onboarding timing.",
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
          Apply for the
          <br />
          ZecTix Luma integration beta.
        </h1>
        <p className="landing-sub">
          We are opening a limited number of beta spots for organizers who want
          to keep Luma as their event system of record and add a managed Zcash
          checkout path where it makes sense.
        </p>
      </section>

      <section className="landing-section landing-interest-section">
        <div className="landing-interest-layout">
          <div className="landing-interest-overview">
            <div className="landing-interest-card">
              <p className="landing-label">What happens next</p>
              <h2 className="landing-section-title landing-interest-title">
                A short application for the initial cohort.
              </h2>
              <p className="landing-section-desc">
                This application sends your details directly to the ZecTix team
                so we can review fit, prioritize the strongest early matches,
                and follow up personally. No extra organizer account is required
                at this stage.
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
              <p className="landing-path-label">Early beta</p>
              <p className="landing-path-desc">
                We’re keeping the first beta cohort intentionally small so
                onboarding can stay hands-on and we can focus on the organizers
                and event flows that are the best fit for private Zcash
                payments.
              </p>
            </div>
          </div>

          <div className="landing-interest-card landing-interest-form-card">
            <p className="landing-label">Inquiry form</p>
            <h2 className="landing-section-title landing-interest-title">
              Share a few details.
            </h2>
            <p className="landing-section-desc">
              We only need enough information to understand your use case,
              evaluate fit for the beta, and follow up.
            </p>
            <LumaIntegrationInterestForm />
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <span className="landing-wordmark">ZecTix</span>
        <p>Built on Zcash</p>
      </footer>
    </main>
  );
}
