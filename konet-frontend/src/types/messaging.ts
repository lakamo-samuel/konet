export type RealtimeTicket = {
  ticket: string;
  expiresAt: string;
  url: string;
  path: string;
};
export type ReadReceipt = {
  conversationId: string;
  userId: string;
  readAt: string;
};
export type ReadResult = { message: string; readAt: string };
export type SocketAck<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };
export type ConnectionState = {
  status: "connecting" | "connected" | "disconnected" | "error";
  message: string;
};
