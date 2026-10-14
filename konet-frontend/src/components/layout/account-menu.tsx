"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/ui/icon";
import { Avatar } from "@/components/ui/avatar";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { useDropdownDismiss } from "./use-dropdown-dismiss";

export function AccountMenu({ name, avatar, links }: { name: string; avatar?: string; links: readonly {href: string; label: string}[] }) {
  const path = usePathname();
  const ref = useDropdownDismiss();
  return (
    <details className="account-dropdown" key={path} ref={ref}>
      <summary aria-label="Open account menu">
        <Avatar src={avatar ?? ""} name={name} size={34} />
        <span className="account-menu-name">{name.split(" ")[0]}</span>
        <Icon name="chevron" size={15} />
      </summary>
      <nav aria-label="Account navigation">
        <div className="account-menu-heading"><strong>{name}</strong><span>Your Konet account</span></div>
        {links.map(link => <Link key={link.href} href={link.href} aria-current={path === link.href || path.startsWith(`${link.href}/`) ? "page" : undefined}>{link.label}</Link>)}
        <SignOutButton />
      </nav>
    </details>
  );
}
