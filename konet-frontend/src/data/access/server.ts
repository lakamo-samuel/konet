import { sessionEndingCommands } from "@/lib/auth/commands";
import { redirect } from "next/navigation";
import { DataError } from "./errors";
import { authenticate, clearSession, logoutAuth } from "@/lib/auth/live";
import { backendRequest } from "./backend";
import "server-only";
import { headers, cookies } from "next/headers";
import { usesBearerStorage } from "@/lib/auth/transport";
import { httpSource } from "./http";
import type {
  CommandInput,
  CommandName,
  DataContext,
  QueryInput,
  QueryName,
} from "./contracts";

export function sourceMode(): "http" {
  return "http";
}
export async function dataContext(): Promise<DataContext> {
  const store = await cookies();
  const authorization = usesBearerStorage
    ? (await headers()).get("authorization")
    : null;
  return {
    accessToken: authorization?.startsWith("Bearer ")
      ? authorization.slice(7)
      : store.get("konet_access")?.value,
  };
}
export async function serverQuery<K extends QueryName>(
  name: K,
  input: QueryInput<K>,
  page = true,
) {
  try {
    return await httpSource.query(name, input, await dataContext());
  } catch (error) {
    if (
      page &&
      sourceMode() === "http" &&
      error instanceof DataError &&
      error.status === 401
    ) {
      const next = (await headers()).get("x-konet-pathname") ?? "/discover";
      redirect(
        `${(await cookies()).has("konet_refresh") ? "/session/refresh" : "/sign-in"}?next=${encodeURIComponent(next)}`,
      );
    }
    throw error;
  }
}
export async function serverCommand<K extends CommandName>(
  name: K,
  input: CommandInput<K>,
) {
  if (sourceMode() === "http") {
    if (name === "signIn")
      return authenticate("/auth/login", input) as Promise<
        import("./contracts").CommandResult<K>
      >;
    if (name === "signUp") {
      const data = input as CommandInput<"signUp">;
      return authenticate("/auth/register", {
        fullName: data.name,
        email: data.email,
        password: data.password,
        universityId: data.universityId,
        campusId: data.campusId,
      }) as Promise<import("./contracts").CommandResult<K>>;
    }
    if (name === "signOut")
      return logoutAuth() as Promise<import("./contracts").CommandResult<K>>;
    if (name === "resetPassword") {
      await backendRequest("POST", "/auth/reset-password", { body: input });
      await clearSession();
      return { accepted: true } as import("./contracts").CommandResult<K>;
    }
  }
  const result = await httpSource.command(name, input, await dataContext());
  if (sessionEndingCommands.includes(name)) await clearSession();
  return result;
}
