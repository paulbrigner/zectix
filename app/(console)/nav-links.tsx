"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/admin", label: "Admin" },
];

export function ConsoleNavLinks() {
  const pathname = usePathname();

  return (
    <nav className="console-nav" aria-label="Operations navigation">
      {LINKS.map((link) => {
        const isActive = pathname === link.href;
        return (
          <Link
            className={`console-nav-link${isActive ? " console-nav-link-active" : ""}`}
            href={link.href}
            key={link.href}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
