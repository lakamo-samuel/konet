"use client";

import { usePathname } from "next/navigation";
import { SiteFooter } from "./site-footer";

export function MarketingFooter() {
  return usePathname() === "/" ? <SiteFooter /> : null;
}
