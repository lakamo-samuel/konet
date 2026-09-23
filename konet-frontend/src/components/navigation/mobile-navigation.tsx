import Link from "next/link";import Icon from "@/components/ui/icon";import {mobileNavigation} from "@/lib/constants/navigation";
export function MobileNavigation(){return <nav className="mobile-nav" aria-label="Mobile navigation">{mobileNavigation.map(item=><Link key={item.href} href={item.href}><Icon name={item.icon} size={21}/><span>{item.label}</span></Link>)}</nav>}
