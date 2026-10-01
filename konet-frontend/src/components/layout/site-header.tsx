import Link from "next/link";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { primaryNavigation } from "@/lib/constants/navigation";
import { getSession } from "@/lib/auth/session";
import { getNotificationsForUser } from "@/data/repositories/notification.repository";
export async function SiteHeader() {
  const session = await getSession();
  const unreadCount = session
    ? (await getNotificationsForUser(session.userId)).filter(
        (item) => !item.read,
      ).length
    : 0;
  return (
    <header className="site-header">
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
          {session ? (
            <>
              <Link
                className="icon-button notification-trigger"
                href="/notifications"
                aria-label={
                  unreadCount
                    ? `Notifications, ${unreadCount} unread`
                    : "Notifications"
                }
              >
                <Icon name="bell" />
                {unreadCount > 0 && (
                  <span className="absolute -right-2 -top-2 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[var(--clay)] px-1 text-[10px] font-bold leading-none text-white ring-2 ring-[var(--canvas)]" aria-hidden="true">{unreadCount > 99 ? "99+" : unreadCount}</span>
                )}
              </Link>
              <Link
                className="account-avatar"
                href="/profile"
                aria-label="Your profile"
              >
                S
              </Link>
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
