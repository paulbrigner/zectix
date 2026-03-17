"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/admin", label: "Admin" },
];

export function TestNavLinks() {
  const pathname = usePathname();

  return (
    <nav className="test-nav" aria-label="Test navigation">
      {LINKS.map((link) => {
        const isActive = pathname === link.href;
        return (
          <Link
            className={`test-nav-link${isActive ? " test-nav-link-active" : ""}`}
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
