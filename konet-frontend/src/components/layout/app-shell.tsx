import { RealtimeProvider } from "@/lib/realtime/provider";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/data/repositories/user.repository";
import type { ReactNode } from "react";
import { SiteHeader } from "./site-header";
import { MobileNavigation } from "@/components/navigation/mobile-navigation";
export async function AppShell({ children }: { children: ReactNode }) {
  const user = (await cookies()).has("konet_access") ? await getCurrentUser() : null;
  return (
    <RealtimeProvider initialUser={user}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main">{children}</main>
      <MobileNavigation />
    </RealtimeProvider>
  );
}
//
