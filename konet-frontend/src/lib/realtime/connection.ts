import { io, type Socket } from "socket.io-client";
import type { Conversation, Message } from "@/types/domain";
import type {
  ConnectionState,
  ReadReceipt,
  ReadResult,
  RealtimeTicket,
  SocketAck,
} from "@/types/messaging";
export class DeliveryError extends Error {
  constructor(
    message: string,
    readonly uncertain = false,
  ) {
    super(message);
  }
}
type Dependencies = {
  ticket: () => Promise<RealtimeTicket>;
  refresh: () => Promise<void>;
  onMessage: (message: Message) => void;
  onNotification: () => void;
  onReceipt: (receipt: ReadReceipt) => void;
  onReconnect: () => void;
  createSocket?: typeof io;
};
export class RealtimeConnection {
  private socket?: Socket;
  private active = false;
  private generation = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private retryDelay = 1000;
  private authRenewed = false;
  private rooms = new Map<string, Set<() => void>>();
  private listeners = new Set<() => void>();
  private state: ConnectionState = {
    status: "connecting",
    message: "Connecting to live chat…",
  };
  constructor(private deps: Dependencies) {}
  subscribe = (callback: () => void) => {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  };
  snapshot = () => this.state;
  private update(status: ConnectionState["status"], message: string) {
    this.state = { status, message };
    for (const callback of this.listeners) callback();
  }
  start() {
    this.active = true;
    void this.open();
  }
  stop() {
    this.active = false;
    this.generation++;
    clearTimeout(this.timer);
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = undefined;
    this.update("disconnected", "Live chat disconnected.");
  }
  reconnect = () => {
    if (this.active) {
      clearTimeout(this.timer);
      void this.open();
    }
  };
  private retry(message: string) {
    if (!this.active) return;
    this.update("disconnected", message);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.open();
    }, this.retryDelay);
    this.retryDelay = Math.min(this.retryDelay * 2, 30000);
  }
  private async open() {
    const generation = ++this.generation;
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = undefined;
    this.update("connecting", "Connecting to live chat…");
    try {
      const credentials = await this.deps.ticket();
      if (!this.active || generation !== this.generation) return;
      const socket = (this.deps.createSocket ?? io)(credentials.url, {
        path: credentials.path,
        auth: { ticket: credentials.ticket },
        autoConnect: false,
        reconnection: false,
        retries: 0,
        timeout: 10000,
      });
      this.socket = socket;
      socket.on("connect", () => {
        this.retryDelay = 1000;
        this.authRenewed = false;
        this.update("connected", "Live chat connected.");
        for (const id of this.rooms.keys()) void this.join(id);
        this.deps.onReconnect();
      });
      socket.on("message.new", this.deps.onMessage);
      socket.on("notification.new", this.deps.onNotification);
      socket.on("conversation.read", this.deps.onReceipt);
      socket.on("disconnect", () =>
        this.retry("Connection lost. Reconnecting…"),
      );
      socket.on(
        "connect_error",
        (error: Error & { data?: { code?: string } }) => {
          if (error.data?.code === "UNAUTHORIZED" && !this.authRenewed) {
            this.authRenewed = true;
            void this.deps
              .refresh()
              .then(() => this.reconnect())
              .catch(() =>
                this.update(
                  "error",
                  "Your session has ended. Sign in again to reconnect.",
                ),
              );
          } else if (error.data?.code === "UNAUTHORIZED") {
            this.update(
              "error",
              "Your session has ended. Sign in again to reconnect.",
            );
          } else this.retry("Live chat is unavailable. Reconnecting…");
        },
      );
      socket.connect();
    } catch (error) {
      if (!this.active || generation !== this.generation) return;
      const status = (error as { response?: { status?: number } })?.response
        ?.status;
      if (status === 401 || status === 403)
        this.update(
          "error",
          "Your session has ended. Sign in again to reconnect.",
        );
      else this.retry("Live chat is unavailable. Reconnecting…");
    }
  }
  watchConversation(id: string, joined: () => void) {
    const callbacks = this.rooms.get(id) ?? new Set();
    callbacks.add(joined);
    this.rooms.set(id, callbacks);
    if (this.socket?.connected) void this.join(id);
    return () => {
      callbacks.delete(joined);
      if (!callbacks.size) {
        this.rooms.delete(id);
        if (this.socket?.connected)
          void this.ack("conversation.leave", { conversationId: id }).catch(
            () => undefined,
          );
      }
    };
  }
  private async join(id: string) {
    const generation = this.generation;
    try {
      await this.ack<Conversation>("conversation.join", { conversationId: id });
      if (!this.active || generation !== this.generation) return;
      for (const callback of this.rooms.get(id) ?? []) callback();
    } catch (error) {
      if (!this.active || generation !== this.generation) return;
      this.update(
        "error",
        error instanceof Error
          ? error.message
          : "This conversation could not be opened.",
      );
    }
  }
  private ack<T>(event: string, payload: unknown): Promise<T> {
    if (!this.socket?.connected)
      return Promise.reject(
        new DeliveryError("Connect to live chat before sending."),
      );
    const generation = this.generation;
    return new Promise((resolve, reject) => {
      this.socket!.timeout(10000).emit(
        event,
        payload,
        (error: Error | null, result: SocketAck<T>) => {
          if (!this.active || generation !== this.generation)
            return reject(
              new DeliveryError(
                "The connection changed before acknowledgement. Reload history before retrying.",
                event === "message.send",
              ),
            );
          if (error)
            return reject(
              new DeliveryError(
                "Delivery is uncertain. Reload history before sending this message again.",
                event === "message.send",
              ),
            );
          if (!result?.ok)
            return reject(
              new DeliveryError(
                result?.error?.message ?? "The action could not be completed.",
              ),
            );
          resolve(result.data);
        },
      );
    });
  }
  async send(conversationId: string, content: string) {
    if (!content.trim() || content.length > 10000)
      throw new DeliveryError("Enter a message of 1–10,000 characters.");
    const message = await this.ack<Message>("message.send", {
      conversationId,
      content,
    });
    this.deps.onMessage(message);
    return message;
  }
  read(conversationId: string) {
    return this.ack<ReadResult>("conversation.read", { conversationId });
  }
}
