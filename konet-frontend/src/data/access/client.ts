import axios from "axios";
import { readAccessToken, saveAccessToken } from "@/lib/auth/transport";
import { refreshSession } from "@/lib/auth/refresh-client";
import type {
  CommandInput,
  CommandName,
  CommandResult,
  QueryInput,
  QueryName,
  QueryResult,
} from "./contracts";

const http = axios.create({
  baseURL: "/api/frontend",
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});
http.interceptors.request.use((config) => {
  const token = readAccessToken();
  if (token) config.headers.set("Authorization", `Bearer ${token}`);
  return config;
});
http.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config as
      | (import("axios").InternalAxiosRequestConfig & { renewed?: boolean })
      | undefined;
    const commandName =
      typeof config?.data === "string"
        ? (() => {
            try {
              return JSON.parse(config.data).name;
            } catch {
              return undefined;
            }
          })()
        : undefined;
    if (
      error.response?.status === 401 &&
      config &&
      !config.renewed &&
      ![
        "signIn",
        "signUp",
        "forgotPassword",
        "resetPassword",
        "signOut",
      ].includes(commandName)
    ) {
      config.renewed = true;
      try {
        await refreshSession();
        return await http.request(config);
      } catch {
        throw error;
      }
    }
    throw error;
  },
);
export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error))
    return (
      error.response?.data?.error?.message ??
      "We couldn’t connect. Please try again."
    );
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}
export async function query<K extends QueryName>(
  name: K,
  input: QueryInput<K>,
  signal?: AbortSignal,
): Promise<QueryResult<K>> {
  const response = await http.get<{ data: QueryResult<K> }>("", {
    params: { name, input: JSON.stringify(input) },
    signal,
  });
  return response.data.data;
}
export async function command<K extends CommandName>(
  name: K,
  input: CommandInput<K>,
): Promise<CommandResult<K>> {
  const response = await http.post<{
    data: CommandResult<K>;
    authentication?: { accessToken: string };
  }>("", {
    name,
    input,
  });
  if (["signIn", "signUp"].includes(name))
    saveAccessToken(response.data.authentication?.accessToken);
  if (["signOut", "resetPassword"].includes(name)) saveAccessToken();
  return response.data.data;
}
