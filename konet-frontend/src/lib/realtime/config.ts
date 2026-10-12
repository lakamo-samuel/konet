import "server-only";
import { DataError } from "@/data/access/errors";
export function socketConfiguration() {
  const base =
    process.env.KONET_API_URL ?? "https://api-konet.onrender.com/api/v1";
  const url = new URL(
    process.env.KONET_SOCKET_URL || new URL("/chat", base).toString(),
  );
  const path = process.env.KONET_SOCKET_PATH || "/socket.io";
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !path.startsWith("/") ||
    path.startsWith("//")
  )
    throw new DataError(
      "Live messaging is not configured correctly.",
      503,
      "SOCKET_NOT_CONFIGURED",
    );
  return { url: url.toString(), path };
}
