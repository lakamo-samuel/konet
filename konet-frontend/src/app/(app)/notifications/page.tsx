import { getNotificationsForUser } from "@/data/repositories/notification.repository";
import { NotificationFeed } from "@/features/notifications/components/notification-feed";
import { getSession } from "@/lib/auth/session";

export const metadata = { title: "Notifications" };

export default async function Page() {
  const session = await getSession();
  const userId = session?.userId ?? "";
  const items = await getNotificationsForUser(userId);
  return <NotificationFeed userId={userId} initialItems={items} />;
}
