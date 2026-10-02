import "server-only";
import { DataError } from "./errors";
export type BackendResult<T> = {
  data: T;
  refreshToken?: string;
  refreshExpiresAt?: Date;
};
export async function backendRequest<T>(
  method: string,
  path: string,
  options: { body?: unknown; accessToken?: string; refreshToken?: string } = {},
): Promise<BackendResult<T>> {
  const configured =
    process.env.KONET_API_URL ?? "http://localhost:4000/api/v1";
  const url = new URL(`${configured.replace(/\/$/, "")}${path}`);
  if (!["http:", "https:"].includes(url.protocol))
    throw new DataError(
      "The service is unavailable.",
      503,
      "API_NOT_CONFIGURED",
    );
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
      headers: {
        "Content-Type": "application/json",
        ...(options.accessToken
          ? { Authorization: `Bearer ${options.accessToken}` }
          : {}),
        ...(options.refreshToken
          ? { Cookie: `konet_refresh=${options.refreshToken}` }
          : {}),
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new DataError(
      "We could not reach Konet. Please try again.",
      502,
      "API_UNAVAILABLE",
    );
  }
  const data =
    response.status === 204
      ? undefined
      : await response.json().catch(() => undefined);
  if (!response.ok) {
    const detail = data as { message?: unknown; code?: string } | undefined;
    const message =
      response.status >= 500
        ? "This service is temporarily unavailable. Please try again later."
        : Array.isArray(detail?.message)
          ? detail.message.filter((x) => typeof x === "string").join(" ")
          : typeof detail?.message === "string"
            ? detail.message
            : "We could not complete this request.";
    throw new DataError(
      message,
      response.status,
      detail?.code ?? "REQUEST_FAILED",
    );
  }
  const cookie = response.headers.get("set-cookie");
  const refreshToken = cookie?.match(
    /(?:^|,\s*)konet_refresh=([A-Za-z0-9._-]+)(?:;|$)/,
  )?.[1];
  const expiry = cookie?.match(/Expires=([^;]+)/i)?.[1];
  const refreshExpiresAt = expiry ? new Date(expiry) : undefined;
  return { data: data as T, refreshToken, refreshExpiresAt };
}
