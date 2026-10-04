"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/ui/icon";
import { mobileNavigation } from "@/lib/constants/navigation";
export function MobileNavigation() {
  const path = usePathname();
  return <nav className="mobile-nav" aria-label="Mobile navigation">{mobileNavigation.map(item => <Link key={item.href} href={item.href} aria-current={path === item.href || path.startsWith(`${item.href}/`) ? "page" : undefined}><Icon name={item.icon} size={20} /><span>{item.label}</span></Link>)}</nav>;
}
