import axios from "axios";
import { commandEndpoints, queryEndpoints, type Endpoint } from "./endpoints";
import type { DataContext, DataSource } from "./contracts";
import { DataError } from "./errors";

async function execute<I, O>(endpoint: Endpoint<I, O> | null, input: I, context: DataContext): Promise<O> {
  if (!endpoint) throw new DataError("This action is temporarily unavailable. Please try again later.", 503, "ENDPOINT_NOT_CONFIGURED");
  const baseURL = process.env.KONET_API_URL;
  if (!baseURL) throw new DataError("The service is temporarily unavailable.", 503, "API_NOT_CONFIGURED");
  try {
    const response = await axios.request({ baseURL, method: endpoint.method, url: endpoint.path(input), params: endpoint.params?.(input), data: endpoint.body?.(input), timeout: 15_000, headers: context.accessToken ? { Authorization: `Bearer ${context.accessToken}` } : undefined });
    return endpoint.decode(response.data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) throw new DataError("This item could not be found.", 404, "NOT_FOUND");
      throw new DataError("We couldn’t complete your request. Please try again.", error.response?.status ?? 502);
    }
    throw error;
  }
}
export const httpSource: DataSource = {
  query(name, input, context) { return execute(queryEndpoints[name], input, context); },
  command(name, input, context) { return execute(commandEndpoints[name], input, context); },
};
