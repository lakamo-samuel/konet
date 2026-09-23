import type {ReactNode} from "react";
import Link from "next/link";
import {AppShell} from "@/components/layout/app-shell";
import {getSession} from "@/lib/auth/session";
const links=[["Dashboard","/provider/dashboard"],["Requests","/provider/requests"],["Services","/provider/services"],["Portfolio","/provider/portfolio"],["Earnings","/provider/earnings"],["Settings","/provider/settings"]];
export default async function ProviderLayout({children}:{children:ReactNode}){const session=await getSession();if(!session?.providerProfileId)return <AppShell><div className="onboarding-shell">{children}</div></AppShell>;return <AppShell><div className="provider-shell"><aside><span className="eyebrow">Provider workspace</span>{links.map(([label,href])=><Link key={href} href={href}>{label}</Link>)}</aside><div>{children}</div></div></AppShell>}
