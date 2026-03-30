import Link from "next/link";
import { HeroGlow } from "@/components/HeroGlow";
import { LumaIntegrationChecklist } from "@/components/LumaIntegrationChecklist";

export const runtime = "nodejs";

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

      <section className="landing-hero landing-interest-hero landing-interest-hero-compact">
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
        <div className="landing-interest-layout landing-interest-layout-single">
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
