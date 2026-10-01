import "server-only";
import { cookies } from "next/headers";
import { mockSource } from "./mock";
import { httpSource } from "./http";
import type { CommandInput, CommandName, DataContext, QueryInput, QueryName } from "./contracts";

export function sourceMode() {
  const mode = process.env.KONET_DATA_SOURCE ?? "mock";
  if (mode !== "mock" && mode !== "http") throw new Error("KONET_DATA_SOURCE must be mock or http");
  return mode;
}
export async function dataContext(): Promise<DataContext> {
  const store = await cookies();
  return { userId: store.get("konet_session")?.value, providerId: store.get("konet_provider")?.value, accessToken: store.get("konet_access")?.value };
}
export async function serverQuery<K extends QueryName>(name: K, input: QueryInput<K>) {
  return (sourceMode() === "mock" ? mockSource : httpSource).query(name, input, await dataContext());
}
export async function serverCommand<K extends CommandName>(name: K, input: CommandInput<K>) {
  return (sourceMode() === "mock" ? mockSource : httpSource).command(name, input, await dataContext());
}
