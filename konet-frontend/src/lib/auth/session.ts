import { cache } from "react";
import { cookies } from "next/headers";
import { serverQuery } from "@/data/access/server";
export type Session = {
  userId: string;
  isStudentVerified: boolean;
  providerProfileId?: string;
  name?: string;
};
export const getSession = cache(async (): Promise<Session | null> => {
  const store = await cookies();
  if (!store.has("konet_access")) return null;
  const user = await serverQuery("currentUser", {});
  return {
    userId: user.id,
    isStudentVerified: user.studentVerification === "verified",
    providerProfileId: user.providerProfileId,
    name: user.name,
  };
});
