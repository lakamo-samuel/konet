import { cache } from "react";
import { cookies } from "next/headers";
import { serverQuery, sourceMode } from "@/data/access/server";
export type Session = {
  userId: string;
  isStudentVerified: boolean;
  providerProfileId?: string;
  name?: string;
};
export const getSession = cache(async (): Promise<Session | null> => {
  const store = await cookies();
  if (sourceMode() === "mock") {
    const userId = store.get("konet_session")?.value;
    return userId
      ? {
          userId,
          isStudentVerified:
            store.get("konet_student_verified")?.value === "true",
          providerProfileId: store.get("konet_provider")?.value,
        }
      : null;
  }
  if (!store.has("konet_access")) return null;
  const user = await serverQuery("currentUser", {});
  return {
    userId: user.id,
    isStudentVerified: user.studentVerification === "verified",
    providerProfileId: user.providerProfileId,
    name: user.name,
  };
});
