"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
export function HeaderMenu({ links, authenticated }: { links: readonly { href: string; label: string }[]; authenticated: boolean }) {
  const path = usePathname();
  return <details className="header-menu" key={path}><summary aria-label="Open navigation menu"><Menu size={21} /></summary><nav aria-label="More navigation">{links.map(link => <Link key={link.href} href={link.href} aria-current={path === link.href ? "page" : undefined}>{link.label}</Link>)}{authenticated && <SignOutButton />}</nav></details>;
}
