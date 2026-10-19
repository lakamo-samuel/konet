export const primaryNavigation = [
  { href: "/discover", label: "Discover" },
  { href: "/requests", label: "Requests" },
  { href: "/jobs", label: "Jobs" },
  { href: "/disputes", label: "Disputes" },
  { href: "/messages", label: "Messages" },
] as const;

export const publicNavigation = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/for-providers", label: "For providers" },
  { href: "/trust-and-safety", label: "Trust & safety" },
] as const;

const relatedSections: Record<string, readonly string[]> = {
  "/discover": ["/search", "/providers"],
  "/requests": ["/quotes"],
  "/jobs": ["/checkout", "/payment-result", "/reviews"],
  "/profile": ["/settings", "/verification"],
};

export function isNavigationActive(path: string, href: string) {
  return [href, ...(relatedSections[href] ?? [])].some(
    (section) => path === section || path.startsWith(`${section}/`),
  );
}

export const mobileNavigation = [
  { href: "/discover", label: "Discover", icon: "search" },
  { href: "/jobs", label: "Jobs", icon: "briefcase" },
  { href: "/disputes", label: "Disputes", icon: "shield" },
  { href: "/messages", label: "Messages", icon: "message" },
  { href: "/notifications", label: "Alerts", icon: "bell" },
  { href: "/profile", label: "Profile", icon: "user" },
] as const;
