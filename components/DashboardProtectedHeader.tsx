"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { appPath } from "@/lib/app-paths";

function isTenantScopedDashboardRoute(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  return (
    segments[0] === "dashboard" && segments.length > 1 && segments[1] !== "help"
  );
}

export function DashboardProtectedHeader() {
  const pathname = usePathname();

  if (isTenantScopedDashboardRoute(pathname)) {
    return null;
  }

  return (
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
  );
}
