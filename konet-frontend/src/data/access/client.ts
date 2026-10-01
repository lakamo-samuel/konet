import axios from "axios";
import type { CommandInput, CommandName, CommandResult, QueryInput, QueryName, QueryResult } from "./contracts";

const http = axios.create({ baseURL: "/api/frontend", timeout: 15_000, headers: { "Content-Type": "application/json" } });
export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) return error.response?.data?.error?.message ?? "We couldn’t connect. Please try again.";
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}
export async function query<K extends QueryName>(name: K, input: QueryInput<K>, signal?: AbortSignal): Promise<QueryResult<K>> {
  const response = await http.get<{ data: QueryResult<K> }>("", { params: { name, input: JSON.stringify(input) }, signal });
  return response.data.data;
}
export async function command<K extends CommandName>(name: K, input: CommandInput<K>): Promise<CommandResult<K>> {
  const response = await http.post<{ data: CommandResult<K> }>("", { name, input });
  return response.data.data;
}
