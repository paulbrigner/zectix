"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";

type TenantDashboardHeaderMenuProps = {
  basePath: string;
  onboardingIncomplete: boolean;
  logoutAction: string;
};

type NavItem = {
  disabled?: boolean;
  href: string;
  label: string;
};

function isItemActive(pathname: string, href: string, basePath: string) {
  return pathname === href || (href !== basePath && pathname.startsWith(`${href}/`));
}

function navLinkClassName(active: boolean, disabled: boolean) {
  return [
    "tenant-dashboard-nav-link",
    active ? "tenant-dashboard-nav-link-active" : "",
    disabled ? "tenant-dashboard-nav-link-disabled" : "",
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
  const pathname = usePathname();
  const items: NavItem[] = [
    { disabled: onboardingIncomplete, href: basePath, label: "Overview" },
    { disabled: onboardingIncomplete, href: `${basePath}/events`, label: "Events" },
    { disabled: onboardingIncomplete, href: `${basePath}/billing`, label: "Billing" },
    { href: `${basePath}/connections`, label: "Connections" },
    { disabled: onboardingIncomplete, href: `${basePath}/embed`, label: "Embed" },
    { href: `${basePath}/settings`, label: "Settings" },
  ];

  return (
    <div className="tenant-dashboard-header-actions">
      <nav className="tenant-dashboard-nav" aria-label="Organizer workspace">
        {items.map((item) => {
          const active = isItemActive(pathname, item.href, basePath);
          const disabled = Boolean(item.disabled);

          if (disabled) {
            return (
              <span
                aria-disabled="true"
                className={navLinkClassName(active, disabled)}
                key={item.href}
              >
                {item.label}
              </span>
            );
          }

          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={navLinkClassName(active, disabled)}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <details className="tenant-dashboard-menu">
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
            {items.map((item) => {
              const active = isItemActive(pathname, item.href, basePath);
              const disabled = Boolean(item.disabled);

              if (disabled) {
                return (
                  <span
                    aria-disabled="true"
                    className={menuEntryClassName(active, disabled)}
                    key={`${item.href}-menu`}
                  >
                    {item.label}
                  </span>
                );
              }

              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={menuEntryClassName(active, disabled)}
                  href={item.href}
                  key={`${item.href}-menu`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="tenant-dashboard-menu-divider" />

          <div className="tenant-dashboard-menu-group">
            <Link
              className={menuEntryClassName(pathname === "/dashboard/help", false)}
              href="/dashboard/help"
            >
              Help
            </Link>

            <form action={logoutAction} className="tenant-dashboard-menu-form" method="post">
              <button
                className={menuEntryClassName(false, false, true)}
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
