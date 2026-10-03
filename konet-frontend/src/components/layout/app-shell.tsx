import { RealtimeProvider } from "@/lib/realtime/provider";
import type { ReactNode } from "react";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
import { MobileNavigation } from "@/components/navigation/mobile-navigation";
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <RealtimeProvider>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
      <MobileNavigation />
    </RealtimeProvider>
  );
}
//
