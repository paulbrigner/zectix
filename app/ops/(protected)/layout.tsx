import type { ReactNode } from "react";
import Link from "next/link";
import { isAdminAuthEnabled } from "@/lib/admin-auth";
import { requireOpsPageAccess } from "@/lib/admin-auth-server";
import { appPath } from "@/lib/app-paths";

export const runtime = "nodejs";

export default async function OpsLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  await requireOpsPageAccess();

  return (
    <main className="page console-shell">
      <section className="card console-card-shell">
        <header className="feed-header">
          <div>
            <p className="eyebrow">Operator console</p>
            <h1>LumaZcash service ops</h1>
            <p className="subtle-text">
              Onboard tenants, sync mirrored inventory, inspect webhooks, retry registrations,
              and export monthly billing data.
            </p>
          </div>
          <div className="button-row">
            <Link className="button button-secondary" href="/">
              Marketing home
            </Link>
            {isAdminAuthEnabled() ? (
              <form action={appPath("/api/ops/logout")} method="post">
                <button className="button button-secondary" type="submit">
                  Sign out
                </button>
              </form>
            ) : null}
          </div>
        </header>

        <nav className="console-nav">
          <Link className="console-nav-link" href="/ops">
            Overview
          </Link>
          <Link className="console-nav-link" href="/ops/tenants">
            Tenants
          </Link>
          <span
            aria-disabled="true"
            className="console-nav-link console-nav-link-disabled"
            title="Reports is temporarily disabled while the billing workflow is refined."
          >
            Reports
          </span>
        </nav>

        <div className="console-content">{children}</div>
      </section>
    </main>
  );
}
