"use client";
import Link from "next/link";
import Icon from "@/components/ui/icon";
import { useDataQuery } from "@/lib/query/hooks";
import type { Notification } from "@/types/domain";
export function NotificationBell({
  userId,
  initialNotifications,
}: {
  userId: string;
  initialNotifications: Notification[];
}) {
  const notifications = useDataQuery(
    "notifications",
    { userId, status: "unread" },
    initialNotifications,
  );
  const count = notifications.isError ? 0 : (notifications.data?.length ?? 0);
  const label = count >= 100 ? "99+" : String(count);
  return (
    <Link
      className="icon-button notification-trigger"
      href="/notifications"
      aria-label={count ? `Notifications, ${label} unread` : "Notifications"}
      title={
        notifications.isError ? "Could not refresh notifications" : undefined
      }
    >
      <Icon name="bell" />
      {count > 0 && (
        <span
          className="absolute -right-2 -top-2 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[var(--clay)] px-1 text-[10px] font-bold leading-none text-white ring-2 ring-[var(--canvas)]"
          aria-hidden="true"
        >
          {label}
        </span>
      )}
    </Link>
  );
}
