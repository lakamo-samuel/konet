import { cache } from "react";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/data/repositories/user.repository";
export type Session = {
  userId: string;
  roles: string[];
  isStudentVerified: boolean;
  providerProfileId?: string;
  name?: string;
};
export const getSession = cache(async (): Promise<Session | null> => {
  const store = await cookies();
  if (!store.has("konet_access")) return null;
  const user = await getCurrentUser();
  return {
    userId: user.id,
    roles: user.roles ?? [],
    isStudentVerified: user.studentVerification === "verified",
    providerProfileId: user.providerProfileId,
    name: user.name,
  };
});
