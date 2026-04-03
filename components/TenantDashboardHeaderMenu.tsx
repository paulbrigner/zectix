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
  disabled?: boolean;
  href: string;
  label: string;
};

function tenantSlugFromBasePath(basePath: string) {
  return basePath.split("/").filter(Boolean)[1] || "";
}

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

function subnavLinkClassName(active: boolean) {
  return [
    "tenant-dashboard-subnav-link",
    active ? "tenant-dashboard-subnav-link-active" : "",
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
  const showConnectionsSubmenu = !onboardingIncomplete;
  const activeConnectionsTab =
    searchParams.get("tab") === "cipherpay" ? "cipherpay" : "luma";
  const connectionsSubItems: NavItem[] = [
    { href: `${connectionsHref}?tab=luma`, label: "Luma" },
    { href: `${connectionsHref}?tab=cipherpay`, label: "CipherPay" },
  ];
  const primaryItems: NavItem[] = [
    { disabled: onboardingIncomplete, href: basePath, label: "Overview" },
    { disabled: onboardingIncomplete, href: `${basePath}/events`, label: "Events" },
    { href: connectionsHref, label: "Connections" },
    { disabled: onboardingIncomplete, href: `${basePath}/embed`, label: "Embed" },
    { disabled: onboardingIncomplete, href: `${basePath}/billing`, label: "Billing" },
  ];
  const showingConnectionsSubmenu =
    showConnectionsSubmenu && pathname === connectionsHref;

  function isConnectionsSubitemActive(label: string) {
    if (!showingConnectionsSubmenu) {
      return false;
    }

    return activeConnectionsTab === "cipherpay"
      ? label === "CipherPay"
      : label === "Luma";
  }

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
            const disabled = Boolean(item.disabled);
            const isConnectionsItem = item.href === connectionsHref;

            return (
              <div
                className={`tenant-dashboard-nav-item${
                  isConnectionsItem
                    ? " tenant-dashboard-nav-item-connections"
                    : ""
                }`}
                key={item.href}
              >
                {disabled ? (
                  <span
                    aria-disabled="true"
                    className={navLinkClassName(active, disabled)}
                  >
                    {item.label}
                  </span>
                ) : (
                  <Link
                    aria-current={active ? "page" : undefined}
                    className={navLinkClassName(active, disabled)}
                    href={item.href}
                  >
                    {item.label}
                  </Link>
                )}

                {isConnectionsItem && showConnectionsSubmenu ? (
                  <div
                    aria-hidden={!showingConnectionsSubmenu}
                    className={`tenant-dashboard-subnav${
                      showingConnectionsSubmenu
                        ? ""
                        : " tenant-dashboard-subnav-hidden"
                    }`}
                    role="group"
                  >
                    {connectionsSubItems.map((subitem) => {
                      const subitemActive = isConnectionsSubitemActive(
                        subitem.label,
                      );

                      return (
                        <Link
                          aria-current={subitemActive ? "page" : undefined}
                          className={subnavLinkClassName(subitemActive)}
                          href={subitem.href}
                          key={subitem.href}
                          tabIndex={showingConnectionsSubmenu ? undefined : -1}
                        >
                          {subitem.label}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
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
              const disabled = Boolean(item.disabled);
              const isConnectionsItem = item.href === connectionsHref;

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

              return isConnectionsItem ? (
                <div
                  className="tenant-dashboard-menu-submenu-shell"
                  key={`${item.href}-menu`}
                >
                  <Link
                    aria-current={active ? "page" : undefined}
                    className={menuEntryClassName(active, disabled)}
                    href={item.href}
                    onClick={closeMenu}
                  >
                    {item.label}
                  </Link>
                  {showConnectionsSubmenu ? (
                    <div className="tenant-dashboard-menu-subgroup">
                      {connectionsSubItems.map((subitem) => {
                        const subitemActive = isConnectionsSubitemActive(
                          subitem.label,
                        );

                        return (
                          <Link
                            aria-current={subitemActive ? "page" : undefined}
                            className={`${menuEntryClassName(
                              subitemActive,
                              false,
                            )} tenant-dashboard-menu-entry-submenu`}
                            href={subitem.href}
                            key={subitem.href}
                            onClick={closeMenu}
                          >
                            {subitem.label}
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              ) : (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={menuEntryClassName(active, disabled)}
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
