import type { ReactNode } from "react";
import { SiteHeader } from "@/components/layout/site-header";
import { MarketingFooter } from "@/components/layout/marketing-footer";

export default function MarketingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <SiteHeader publicPage />
      <main>{children}</main>
      <MarketingFooter />
    </>
  );
}
