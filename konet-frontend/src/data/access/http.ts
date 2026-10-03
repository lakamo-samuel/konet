import { liveUser } from "@/lib/auth/live";
import { backendRequest } from "./backend";
import { commandEndpoints, queryEndpoints, type Endpoint } from "./endpoints";
import type { DataContext, DataSource } from "./contracts";
import { DataError } from "./errors";

async function execute<I, O>(
  endpoint: Endpoint<I, O> | null,
  input: I,
  context: DataContext,
): Promise<O> {
  if (!endpoint)
    throw new DataError(
      "This action is temporarily unavailable. Please try again later.",
      503,
      "ENDPOINT_NOT_CONFIGURED",
    );
  const params = endpoint.params?.(input) as
    Record<string, unknown> | undefined;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {}))
    if (value !== undefined) query.set(key, String(value));
  const path = endpoint.path(input) + (query.size ? `?${query}` : "");
  try {
    const response = await backendRequest<unknown>(typeof endpoint.method === "function" ? endpoint.method(input) : endpoint.method, path, {
      body: endpoint.body?.(input),
      accessToken: context.accessToken,
    });
    return endpoint.decode(response.data);
  } catch (error) {
    if (
      error instanceof DataError &&
      error.status === 404 &&
      endpoint.notFoundCode === error.code
    )
      return endpoint.decode(null);
    throw error;
  }
}
export const httpSource: DataSource = {
  async query(name, input, context) {
    if (name === "currentUser" || name === "user") {
      if (!context.accessToken)
        throw new DataError("Please sign in again.", 401, "SESSION_REQUIRED");
      const user = await liveUser(context.accessToken);
      return (
        name === "user" && (input as { id: string }).id !== user.id
          ? null
          : user
      ) as import("./contracts").QueryResult<typeof name>;
    }
    return execute(queryEndpoints[name], input, context);
  },
  command(name, input, context) {
    return execute(commandEndpoints[name], input, context);
  },
};
