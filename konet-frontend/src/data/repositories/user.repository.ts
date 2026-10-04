import { cache } from "react";
import { serverQuery } from "@/data/access/server";
export const getCurrentUser = cache(() => serverQuery("currentUser", {}));
export const getUserById = (id: string) => serverQuery("user", { id });
