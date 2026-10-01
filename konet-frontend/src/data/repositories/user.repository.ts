import { serverQuery } from "@/data/access/server";
export const getCurrentUser = () => serverQuery("currentUser", {});
export const getUserById = (id: string) => serverQuery("user", { id });
