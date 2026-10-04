"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { isNavigationActive } from "@/lib/constants/navigation";
import { useDropdownDismiss } from "./use-dropdown-dismiss";
type MenuLink = { href: string; label: string };
export function HeaderMenu({ links, accountLinks, authenticated }: { links: readonly MenuLink[]; accountLinks: readonly MenuLink[]; authenticated: boolean }) {
  const path = usePathname();
  const ref = useDropdownDismiss();
  return (
    <details className="header-menu" key={path} ref={ref}>
      <summary aria-label="Open navigation menu"><Menu size={21} /></summary>
      <nav aria-label="More navigation">
        <span className="menu-section-label">Explore Konet</span>
        {links.map(link => <Link key={link.href} href={link.href} aria-current={isNavigationActive(path, link.href) ? "page" : undefined}>{link.label}</Link>)}
        <span className="menu-section-label menu-section-divider">Your account</span>
        {accountLinks.map(link => <Link key={link.href} href={link.href} aria-current={path === link.href || path.startsWith(`${link.href}/`) ? "page" : undefined}>{link.label}</Link>)}
        {authenticated && <SignOutButton />}
      </nav>
    </details>
  );
}
