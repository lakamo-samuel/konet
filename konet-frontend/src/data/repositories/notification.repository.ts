import { serverQuery } from "@/data/access/server";
export const getNotificationsForUser = (userId: string) =>
  serverQuery("notifications", { userId });

export const getUnreadNotificationsForUser = (userId: string) =>
  serverQuery("notifications", { userId, status: "unread" });
