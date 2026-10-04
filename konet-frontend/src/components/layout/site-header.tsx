import { HeaderMenu } from "./header-menu";
import { isStaff } from "@/features/admin/operations";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import Link from "next/link";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { primaryNavigation } from "@/lib/constants/navigation";
import { getSession } from "@/lib/auth/session";
import { getUnreadNotificationsForUser } from "@/data/repositories/notification.repository";
export async function SiteHeader() {
  const session = await getSession();
  const notifications = session
    ? await getUnreadNotificationsForUser(session.userId)
    : [];
  return (
    <header className="site-header" data-authenticated={!!session}>
      <div className="header-inner">
        <Link className="wordmark" href={session ? "/discover" : "/"}>
          konet
          <span className="logo-dot" />
        </Link>
        <nav className="desktop-nav" aria-label="Primary navigation">
          {session ? (
            primaryNavigation.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))
          ) : (
            <>
              <Link href="/how-it-works">How it works</Link>
              <Link href="/for-providers">For providers</Link>
              <Link href="/trust-and-safety">Trust & safety</Link>
            </>
          )}
        </nav>
        <div className="header-actions">
          <HeaderMenu authenticated={!!session} links={session ? [...primaryNavigation, { href: "/profile", label: "Your profile" }, { href: "/settings", label: "Account settings" }, { href: session.providerProfileId ? "/provider/dashboard" : "/provider/onboarding", label: session.providerProfileId ? "Provider workspace" : "Offer a service" }, ...(isStaff(session.roles) ? [{ href: "/admin", label: "Admin dashboard" }] : [])] : [{ href: "/how-it-works", label: "How it works" }, { href: "/for-providers", label: "For providers" }, { href: "/trust-and-safety", label: "Trust & safety" }, { href: "/sign-in", label: "Sign in" }, { href: "/sign-up", label: "Create an account" }]} />
          {session ? (
            <>
              <NotificationBell
                userId={session.userId}
                initialNotifications={notifications}
              />
              <Link
                className="account-avatar"
                href="/profile"
                aria-label="Your profile"
              >
                {session.name?.charAt(0) ?? "Account"}
              </Link>
              <SignOutButton />
              {isStaff(session.roles) && <Button href="/admin" variant="secondary">Staff dashboard</Button>}
              {session.providerProfileId ? (
                <Button className="header-cta" href="/provider/dashboard">
                  My workspace
                  <Icon name="arrow" size={16} />
                </Button>
              ) : (
                <Button className="header-cta" href="/provider/onboarding">
                  Offer a service
                  <Icon name="arrow" size={16} />
                </Button>
              )}
            </>
          ) : (
            <>
              <Link className="signin-button" href="/sign-in">
                Sign in
              </Link>
              <Button href="/sign-up">
                Get started
                <Icon name="arrow" size={16} />
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
