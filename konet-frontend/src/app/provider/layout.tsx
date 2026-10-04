import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { getSession } from "@/lib/auth/session";
const links = [
  ["Dashboard", "/provider/dashboard"],
  ["Requests", "/provider/requests"],
  ["Services", "/provider/services"],
  ["Portfolio", "/provider/portfolio"],
  ["Earnings", "/provider/earnings"],
  ["Settings", "/provider/settings"],
];
export default async function ProviderLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  if (!session.isStudentVerified) redirect("/verify-student");
  const path =
    (await headers()).get("x-konet-pathname") ?? "/provider/onboarding";
  if (!session.providerProfileId && !path.startsWith("/provider/onboarding"))
    redirect("/provider/onboarding");
  if (!session?.providerProfileId)
    return (
      <AppShell>
        <div className="onboarding-shell">{children}</div>
      </AppShell>
    );
  return (
    <AppShell>
      <div className="provider-shell">
        <aside className="provider-navigation">
          <span className="eyebrow">Provider workspace</span>
          <nav aria-label="Provider navigation">{links.map(([label, href]) => (
            <Link key={href} href={href} aria-current={path === href || path.startsWith(`${href}/`) ? "page" : undefined}>
              {label}
            </Link>
          ))}</nav>
        </aside>
        <div>{children}</div>
      </div>
    </AppShell>
  );
}
