import type { ReactNode } from "react";
import Link from "next/link";
import { TestNavLinks } from "./nav-links";

export const runtime = "nodejs";

export default function TestLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <main className="page test-shell">
      <section className="card test-card-shell">
        <header className="feed-header">
          <div>
            <p className="eyebrow">Event Payment Test</p>
            <h1>Zcash Event Test Dashboard</h1>
            <p className="subtle-text">
              Overview, admin, checkout, and webhook tools for local CipherPay +
              Luma registration testing.
            </p>
          </div>
          <div className="button-row">
            <Link className="button button-secondary" href="/">
              Home
            </Link>
          </div>
        </header>

        <TestNavLinks />

        <div className="test-content">{children}</div>
      </section>
    </main>
  );
}
