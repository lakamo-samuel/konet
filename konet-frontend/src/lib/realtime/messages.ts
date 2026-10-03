import type { Message } from "@/types/domain";
export function mergeMessages(...collections: Message[][]): Message[] {
  const byId = new Map<string, Message>();
  for (const rows of collections)
    for (const message of rows) byId.set(message.id, message);
  return [...byId.values()].sort(
    (a, b) =>
      Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}
