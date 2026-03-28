import type { ReactNode } from "react";
import Link from "next/link";
import { isTenantEmailAuthEnabled } from "@/lib/tenant-auth";
import { requireTenantPageAccess } from "@/lib/tenant-auth-server";
import { appPath } from "@/lib/app-paths";

export const runtime = "nodejs";

export default async function TenantLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  await requireTenantPageAccess();

  return (
    <main className="page console-shell">
      <section className="card console-card-shell">
        <header className="feed-header">
          <div>
            <p className="eyebrow">Organizer dashboard</p>
            <h1>ZecTix self-serve</h1>
            <p className="subtle-text">
              Connect Luma and CipherPay, review mirrored events, and monitor managed Zcash checkout activity.
            </p>
          </div>
          <div className="button-row">
            <Link className="button button-secondary" href="/">
              Marketing home
            </Link>
            {isTenantEmailAuthEnabled() ? (
              <form action={appPath("/api/dashboard/logout")} method="post">
                <button className="button button-ghost" type="submit">
                  Sign out
                </button>
              </form>
            ) : null}
          </div>
        </header>

        <div className="console-content">{children}</div>
      </section>
    </main>
  );
}
