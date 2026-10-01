import { serverQuery } from "@/data/access/server";
export const getNotificationsForUser = (userId: string) => serverQuery("notifications", { userId });
