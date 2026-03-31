"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function linkClassName(active: boolean) {
  return `console-nav-link${active ? " console-nav-link-active" : ""}`;
}

export function TenantWorkspaceNav({
  basePath,
  onboardingIncomplete,
}: {
  basePath: string;
  onboardingIncomplete: boolean;
}) {
  const pathname = usePathname();
  const items = [
    { disabled: onboardingIncomplete, href: basePath, label: "Overview" },
    { disabled: onboardingIncomplete, href: `${basePath}/events`, label: "Events" },
    { disabled: onboardingIncomplete, href: `${basePath}/billing`, label: "Billing" },
    { href: `${basePath}/connections`, label: "Connections" },
    { disabled: onboardingIncomplete, href: `${basePath}/embed`, label: "Embed" },
    { href: `${basePath}/settings`, label: "Settings" },
  ];

  return (
    <nav className="console-nav tenant-workspace-nav" aria-label="Organizer workspace">
      {items.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== basePath && pathname.startsWith(`${item.href}/`));
        const disabled = Boolean(item.disabled);

        if (disabled) {
          return (
            <span
              aria-disabled="true"
              className={`${linkClassName(active)} console-nav-link-disabled`}
              key={item.href}
            >
              {item.label}
            </span>
          );
        }

        return (
          <Link className={linkClassName(active)} href={item.href} key={item.href}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
