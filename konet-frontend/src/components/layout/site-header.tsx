import { HeaderMenu } from "./header-menu";
import { Avatar } from "@/components/ui/avatar";
import { isStaff } from "@/features/admin/operations";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { AccountMenu } from "./account-menu";
import { DesktopNavigation } from "@/components/navigation/desktop-navigation";
import Link from "next/link";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { primaryNavigation, publicNavigation } from "@/lib/constants/navigation";
import { getSession } from "@/lib/auth/session";
import { getUnreadNotificationsForUser } from "@/data/repositories/notification.repository";
import { optionalPublicData } from "@/data/access/availability";
export async function SiteHeader({ publicPage = false }: { publicPage?: boolean } = {}) {
  const session = publicPage ? (await optionalPublicData(getSession, null)).data : await getSession();
  const notifications = session
    ? publicPage ? (await optionalPublicData(() => getUnreadNotificationsForUser(session.userId), [])).data : await getUnreadNotificationsForUser(session.userId)
    : [];
  const accountLinks = [
    { href: "/profile", label: "Your profile" },
    { href: "/settings", label: "Account settings" },
    { href: session?.providerProfileId ? "/provider/dashboard" : "/provider/onboarding", label: session?.providerProfileId ? "Provider workspace" : "Offer a service" },
    ...(session && isStaff(session.roles) ? [{ href: "/admin", label: "Admin dashboard" }] : []),
  ];
  return (
    <header className="site-header" data-authenticated={!!session}>
      <div className="header-inner">
        <Link className="wordmark" href={session ? "/discover" : "/"}>
          konet
          <span className="logo-dot" />
        </Link>
        <DesktopNavigation authenticated={!!session} />
        <div className="header-actions">
          <HeaderMenu authenticated={!!session} links={session ? primaryNavigation : publicNavigation} accountLinks={session ? accountLinks : [{ href: "/sign-in", label: "Sign in" }, { href: "/sign-up", label: "Create an account" }]} />
          {session ? (
            <>
              <NotificationBell
                userId={session.userId}
                initialNotifications={notifications}
              />
              <Link
                className="account-avatar mobile-account-avatar"
                href="/profile"
                aria-label="Your profile"
              >
                <Avatar src={session.avatar ?? ""} name={session.name ?? "Account"} size={34} />
              </Link>
              <AccountMenu name={session.name ?? "Account"} avatar={session.avatar} links={accountLinks} />
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
