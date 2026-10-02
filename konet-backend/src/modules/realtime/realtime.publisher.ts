import { Injectable } from "@nestjs/common";
import { Namespace, Socket } from "socket.io";
export type LiveEvent = {
  userId: string;
  event: string;
  payload: unknown;
  conversationId?: string;
};
@Injectable()
export class RealtimePublisher {
  private namespace?: Namespace;
  private authorize?: (
    socket: Socket,
    conversationId?: string,
  ) => Promise<boolean>;
  attach(
    namespace: Namespace,
    authorize: (socket: Socket, conversationId?: string) => Promise<boolean>,
  ) {
    this.namespace = namespace;
    this.authorize = authorize;
  }
  async publish(events: LiveEvent[]) {
    if (!this.namespace || !this.authorize) return;
    for (const event of events) {
      for (const socket of this.namespace.sockets.values()) {
        if (socket.data.userId !== event.userId) continue;
        if (
          event.conversationId &&
          !socket.rooms.has(`conversation:${event.conversationId}`)
        )
          continue;
        try {
          if (await this.authorize(socket, event.conversationId))
            socket.emit(event.event, event.payload);
        } catch {
          socket.disconnect(true);
        }
      }
    }
  }
}
