import type { ReactNode } from "react";
import Link from "next/link";
import { isAdminAuthEnabled } from "@/lib/admin-auth";
import { requireAdminPageAccess } from "@/lib/admin-auth-server";
import { appPath } from "@/lib/app-paths";
import { ConsoleNavLinks } from "./nav-links";

export const runtime = "nodejs";

export default async function ConsoleLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  await requireAdminPageAccess();

  return (
    <main className="page console-shell">
      <section className="card console-card-shell">
        <header className="feed-header">
          <div>
            <p className="eyebrow">Operations</p>
            <h1>Zcash Event Dashboard</h1>
            <p className="subtle-text">
              Dashboard, admin, checkout, and webhook tools for the
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

        <ConsoleNavLinks />

        <div className="console-content">{children}</div>
      </section>
    </main>
  );
}
