import "server-only";
import { cookies } from "next/headers";
import { backendRequest } from "@/data/access/backend";
import { DataError } from "@/data/access/errors";
import type { User, University } from "@/types/domain";
export type ApiUser = {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  universityId: string;
  campusId: string;
  studentVerificationStatus: User["studentVerification"];
  roles?: string[];
};
export const mapUser = (u: ApiUser): User => ({
  id: u.id,
  name: u.fullName,
  email: u.email,
  avatar: u.avatarUrl ?? "",
  universityId: u.universityId,
  campus: u.campusId,
  campusId: u.campusId,
  studentVerification: u.studentVerificationStatus,
  identityVerification: "unverified",
  roles: u.roles ?? [],
});
export async function liveUser(accessToken: string): Promise<User> {
  const { data } = await backendRequest<ApiUser>("GET", "/auth/me", {
    accessToken,
  });
  const user = mapUser(data);
  const [directory, own] = await Promise.all([
    backendRequest<
      Omit<University, "campuses"> & {
        campuses: { id: string; name: string }[];
      }
    >("GET", `/universities/${encodeURIComponent(data.universityId)}`).catch(
      (error) => {
        if (error instanceof DataError && error.status === 404) return null;
        throw error;
      },
    ),
    backendRequest<{ id: string }>("GET", "/me/provider-profile", {
      accessToken,
    }).catch((error) => {
      if (error instanceof DataError && error.status === 404) return null;
      throw error;
    }),
  ]);
  user.campus =
    directory?.data.campuses.find((c) => c.id === data.campusId)?.name ??
    data.campusId;
  user.providerProfileId = own?.data.id;
  if (user.providerProfileId) {
    const { data: dimensions } = await backendRequest<
      { dimension: string; status: User["identityVerification"] }[]
    >("GET", "/me/provider-verifications", { accessToken });
    user.identityVerification =
      dimensions.find((d) => d.dimension === "identity")?.status ??
      "unverified";
  }
  return user;
}
const names = [
  "konet_access",
  "konet_refresh",
  "konet_session",
  "konet_provider",
  "konet_student_verified",
];
export async function clearSession() {
  const store = await cookies();
  for (const key of names) store.delete(key);
}
export async function storeTokens(result: {
  data: { accessToken: string };
  refreshToken?: string;
  refreshExpiresAt?: Date;
}) {
  if (
    typeof result.data.accessToken !== "string" ||
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(
      result.data.accessToken,
    ) ||
    !result.refreshToken ||
    !result.refreshExpiresAt ||
    !Number.isFinite(result.refreshExpiresAt.getTime()) ||
    result.refreshExpiresAt <= new Date()
  )
    throw new DataError(
      "Sign-in could not be completed. Please try again.",
      502,
      "INVALID_AUTH_RESPONSE",
    );
  const store = await cookies();
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: result.refreshExpiresAt,
  };
  store.set("konet_access", result.data.accessToken, options);
  store.set("konet_refresh", result.refreshToken, options);
  for (const key of names.slice(2)) store.delete(key);
}
export async function authenticate(
  path: "/auth/login" | "/auth/register",
  body: unknown,
) {
  const result = await backendRequest<{ accessToken: string; user: ApiUser }>(
    "POST",
    path,
    { body },
  );
  await storeTokens(result);
  return mapUser(result.data.user);
}
export async function refreshAuth() {
  const store = await cookies();
  const refreshToken = store.get("konet_refresh")?.value;
  if (!refreshToken)
    throw new DataError("Please sign in again.", 401, "SESSION_REQUIRED");
  try {
    const result = await backendRequest<{ accessToken: string; user: ApiUser }>(
      "POST",
      "/auth/refresh",
      { refreshToken },
    );
    await storeTokens(result);
    return { success: true };
  } catch (error) {
    if (error instanceof DataError && error.status === 401)
      await clearSession();
    throw error;
  }
}
export async function logoutAuth() {
  const store = await cookies();
  const refreshToken = store.get("konet_refresh")?.value;
  if (refreshToken)
    await backendRequest("POST", "/auth/logout", { refreshToken });
  await clearSession();
  return { success: true };
}
// JWT expiry is a scheduling hint only; /auth/me remains the authority.
export function accessExpiresAt(token: string | undefined): number | null {
  try {
    const payload = JSON.parse(
      Buffer.from(token!.split(".")[1], "base64url").toString(),
    ) as { exp: number };
    return Number.isFinite(payload.exp) ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}
