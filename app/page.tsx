import Link from "next/link";

export const runtime = "nodejs";

export default function Home() {
  return (
    <main className="page console-shell">
      <section className="card console-card-shell">
        <div className="console-content">
          <section className="console-section">
            <p className="eyebrow">Managed service</p>
            <h1>LumaZcash for organizers</h1>
            <p className="subtle-text">
              ZecTix now runs as a managed, multi-tenant service for Luma organizers who want
              to accept Zcash through their own CipherPay accounts without custody.
            </p>
            <div className="button-row">
              <Link className="button" href="/ops">
                Open operator console
              </Link>
              <Link className="button button-secondary" href="/ops/tenants">
                View tenants
              </Link>
            </div>
          </section>

          <section className="console-card-grid">
            <article className="console-detail-card">
              <p className="console-kpi-label">Operator-led onboarding</p>
              <p>Connect one organizer at a time with their own Luma calendar and CipherPay account.</p>
            </article>
            <article className="console-detail-card">
              <p className="console-kpi-label">Mirrored event inventory</p>
              <p>Public pages read from synced event and ticket mirrors instead of live global config.</p>
            </article>
            <article className="console-detail-card">
              <p className="console-kpi-label">Async fulfillment</p>
              <p>Webhook acknowledgement stays fast while registration runs through a retryable task queue.</p>
            </article>
          </section>
        </div>
      </section>
    </main>
  );
}
