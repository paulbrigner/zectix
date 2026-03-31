"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function linkClassName(active: boolean) {
  return `console-nav-link${active ? " console-nav-link-active" : ""}`;
}

export function TenantWorkspaceNav({
  basePath,
}: {
  basePath: string;
}) {
  const pathname = usePathname();
  const items = [
    { href: basePath, label: "Overview" },
    { href: `${basePath}/events`, label: "Events" },
    { href: `${basePath}/billing`, label: "Billing" },
    { href: `${basePath}/connections`, label: "Connections" },
    { href: `${basePath}/embed`, label: "Embed" },
    { href: `${basePath}/settings`, label: "Settings" },
  ];

  return (
    <nav className="console-nav tenant-workspace-nav" aria-label="Organizer workspace">
      {items.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== basePath && pathname.startsWith(`${item.href}/`));
        return (
          <Link className={linkClassName(active)} href={item.href} key={item.href}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
