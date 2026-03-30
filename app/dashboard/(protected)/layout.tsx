import type { ReactNode } from "react";
import Link from "next/link";
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
          </div>
          <div className="button-row organizer-shell-actions">
            <Link className="button button-secondary" href="/dashboard/help">
              Help
            </Link>
            <form action={appPath("/api/dashboard/logout")} method="post">
              <button className="button button-secondary" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </header>

        <div className="console-content">{children}</div>
      </section>
    </main>
  );
}
