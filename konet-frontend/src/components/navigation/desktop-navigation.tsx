"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isNavigationActive, primaryNavigation, publicNavigation } from "@/lib/constants/navigation";

export function DesktopNavigation({ authenticated }: { authenticated: boolean }) {
  const path = usePathname();
  const links = authenticated ? primaryNavigation : publicNavigation;
  return (
    <nav className="desktop-nav" aria-label="Primary navigation">
      {links.map(item => (
        <Link key={item.href} href={item.href} aria-current={isNavigationActive(path, item.href) ? "page" : undefined}>
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
