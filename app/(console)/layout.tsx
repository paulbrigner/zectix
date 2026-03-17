import type { ReactNode } from "react";
import Link from "next/link";
import { isAdminAuthEnabled } from "@/lib/admin-auth";
import { requireAdminPageAccess } from "@/lib/admin-auth-server";
import { appPath } from "@/lib/app-paths";
import { TestNavLinks } from "./nav-links";

export const runtime = "nodejs";

export default async function TestLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  await requireAdminPageAccess();

  return (
    <main className="page test-shell">
      <section className="card test-card-shell">
        <header className="feed-header">
          <div>
            <p className="eyebrow">Operations</p>
            <h1>Zcash Event Dashboard</h1>
            <p className="subtle-text">
              Dashboard, admin, checkout, and webhook tools for the local
              CipherPay and Luma registration flow.
            </p>
          </div>
          <div className="button-row">
            <Link className="button button-secondary" href="/">
              Home
            </Link>
            {isAdminAuthEnabled() ? (
              <form action={appPath("/api/admin/logout")} method="post">
                <button className="button button-ghost" type="submit">
                  Sign out
                </button>
              </form>
            ) : null}
          </div>
        </header>

        <TestNavLinks />

        <div className="test-content">{children}</div>
      </section>
    </main>
  );
}
