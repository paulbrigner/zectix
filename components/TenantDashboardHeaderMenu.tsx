"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";

type TenantDashboardHeaderMenuProps = {
  basePath: string;
  onboardingIncomplete: boolean;
  logoutAction: string;
};

type NavItem = {
  href: string;
  label: string;
};

function tenantSlugFromBasePath(basePath: string) {
  return basePath.split("/").filter(Boolean)[1] || "";
}

function isItemActive(pathname: string, href: string, basePath: string) {
  return pathname === href || (href !== basePath && pathname.startsWith(`${href}/`));
}

function navLinkClassName(active: boolean) {
  return [
    "tenant-dashboard-nav-link",
    active ? "tenant-dashboard-nav-link-active" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function menuEntryClassName(active: boolean, disabled: boolean, strong = false) {
  return [
    "tenant-dashboard-menu-entry",
    active ? "tenant-dashboard-menu-entry-active" : "",
    disabled ? "tenant-dashboard-menu-entry-disabled" : "",
    strong ? "tenant-dashboard-menu-entry-strong" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function TenantDashboardHeaderMenu({
  basePath,
  onboardingIncomplete,
  logoutAction,
}: TenantDashboardHeaderMenuProps) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const connectionsHref = `${basePath}/connections`;
  const settingsHref = `${basePath}/settings`;
  const tenantSlug = tenantSlugFromBasePath(basePath);
  const helpHref = tenantSlug
    ? `/dashboard/help?tenant=${encodeURIComponent(tenantSlug)}&from=${encodeURIComponent(pathname)}`
    : "/dashboard/help";
  const primaryItems: NavItem[] = [
    { href: basePath, label: "Overview" },
    { href: `${basePath}/events`, label: "Events" },
    { href: connectionsHref, label: "Connections" },
    { href: `${basePath}/embed`, label: "Embed" },
    { href: `${basePath}/billing`, label: "Billing" },
  ];

  useEffect(() => {
    menuRef.current?.removeAttribute("open");
  }, [pathname, searchKey]);

  function closeMenu() {
    menuRef.current?.removeAttribute("open");
  }

  return (
    <div className="tenant-dashboard-header-actions">
      <div className="tenant-dashboard-nav-stack">
        <nav className="tenant-dashboard-nav" aria-label="Organizer workspace">
          {primaryItems.map((item) => {
            const active = isItemActive(pathname, item.href, basePath);

            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={navLinkClassName(active)}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <details className="tenant-dashboard-menu" ref={menuRef}>
        <summary
          aria-label="Open organizer menu"
          className="tenant-dashboard-menu-trigger"
        >
          <Menu aria-hidden="true" size={18} />
        </summary>

        <div className="tenant-dashboard-menu-content">
          <nav
            aria-label="Organizer workspace"
            className="tenant-dashboard-menu-group tenant-dashboard-menu-group-mobile"
          >
            {primaryItems.map((item) => {
              const active = isItemActive(pathname, item.href, basePath);

              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={menuEntryClassName(active, false)}
                  href={item.href}
                  key={`${item.href}-menu`}
                  onClick={closeMenu}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="tenant-dashboard-menu-divider" />

          <div className="tenant-dashboard-menu-group">
            <Link
              aria-current={pathname === settingsHref ? "page" : undefined}
              className={menuEntryClassName(pathname === settingsHref, false)}
              href={settingsHref}
              onClick={closeMenu}
            >
              Settings
            </Link>

            <Link
              className={menuEntryClassName(pathname === "/dashboard/help", false)}
              href={helpHref}
              onClick={closeMenu}
            >
              Help
            </Link>

            <form action={logoutAction} className="tenant-dashboard-menu-form" method="post">
              <button
                className={menuEntryClassName(false, false, true)}
                onClick={closeMenu}
                type="submit"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </details>
    </div>
  );
}
