import { cache } from "react";
import { serverQuery } from "@/data/access/server";
export const getCurrentUser = cache((page = true) => serverQuery("currentUser", {}, page));
export const getUserById = (id: string) => serverQuery("user", { id });
