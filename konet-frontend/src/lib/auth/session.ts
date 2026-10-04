import { cache } from "react";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/data/repositories/user.repository";
import { DataError } from "@/data/access/errors";
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
  const user = await getCurrentUser(false).catch(error => {
    if (error instanceof DataError && error.status === 401) return null;
    throw error;
  });
  if (!user) return null;
  return {
    userId: user.id,
    roles: user.roles ?? [],
    isStudentVerified: user.studentVerification === "verified",
    providerProfileId: user.providerProfileId,
    name: user.name,
  };
});
