import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { resolveCorsOrigins } from "../../config/cors";
import { Server, Socket } from "socket.io";
import { and, eq, gt, isNull } from "drizzle-orm";
import { DATABASE, Database } from "../../database/database.module";
import { sessions, users } from "../../database/schema";
import { CollaborationService } from "../marketplace/collaboration.service";
import { RealtimePublisher } from "./realtime.publisher";
import { DomainError } from "../../common/errors/domain.error";
@Injectable()
export class RealtimeServer
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private server?: Server;
  constructor(
    private http: HttpAdapterHost,
    private jwt: JwtService,
    private config: ConfigService,
    @Inject(DATABASE) private db: Database,
    private collaboration: CollaborationService,
    private publisher: RealtimePublisher,
  ) {}
  private async authenticate(token: unknown) {
    if (typeof token !== "string" || token.length > 4096)
      throw new Error("Authentication required");
    const payload = await this.jwt.verifyAsync(token, {
      secret: this.config.getOrThrow("JWT_ACCESS_SECRET"),
    });
    if (
      payload.type !== "access" ||
      typeof payload.userId !== "string" ||
      typeof payload.sid !== "string" ||
      typeof payload.exp !== "number"
    )
      throw new Error("Invalid access token");
    const [session] = await this.db
      .select({ id: sessions.id })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(
        and(
          eq(sessions.id, payload.sid),
          eq(sessions.userId, payload.userId),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, new Date()),
          eq(users.accountStatus, "active"),
        ),
      )
      .limit(1);
    if (!session) throw new Error("Session unavailable");
    return payload as { userId: string; sid: string; exp: number };
  }
  private async authorize(socket: Socket, conversationId?: string) {
    try {
      await this.authenticate(socket.data.token);
      if (conversationId)
        await this.collaboration.conversation(
          socket.data.userId,
          conversationId,
        );
      return true;
    } catch {
      socket.disconnect(true);
      return false;
    }
  }
  onApplicationBootstrap() {
    const origins = resolveCorsOrigins(
      this.config.getOrThrow<string>("FRONTEND_URL"),
      this.config.get<string>("CORS_ORIGINS"),
    );
    this.server = new Server(this.http.httpAdapter.getHttpServer(), {
      path: "/socket.io",
      maxHttpBufferSize: 65536,
      cors: { origin: origins, credentials: true },
      allowRequest: (req, done) =>
        done(null, !req.headers.origin || origins.includes(req.headers.origin)),
    });
    const namespace = this.server.of("/chat");
    this.publisher.attach(namespace, (socket, id) =>
      this.authorize(socket, id),
    );
    namespace.use(async (socket, next) => {
      try {
        const p = await this.authenticate(socket.handshake.auth?.token);
        socket.data = { userId: p.userId, token: socket.handshake.auth.token };
        next();
      } catch {
        const error = new Error("Authentication required");
        Object.assign(error, { data: { code: "UNAUTHORIZED" } });
        next(error);
      }
    });
    namespace.on("connection", (socket) => {
      let events = 0;
      let windowStart = Date.now();
      const expiry = setInterval(() => {
        void this.authorize(socket);
      }, 30000);
      expiry.unref();
      socket.on("disconnect", () => clearInterval(expiry));
      const action = (
        name: string,
        handler: (body: Record<string, unknown>) => Promise<unknown>,
      ) =>
        socket.on(name, async (body: unknown, ack: unknown) => {
          const reply = (result: unknown) => {
            if (typeof ack === "function") ack(result);
          };
          try {
            if (Date.now() - windowStart >= 60000) {
              events = 0;
              windowStart = Date.now();
            }
            if (++events > 100)
              throw new DomainError(
                "RATE_LIMITED",
                "Too many socket events.",
                429,
              );
            if (!(await this.authorize(socket))) {
              reply({
                ok: false,
                error: {
                  code: "UNAUTHORIZED",
                  message: "Reconnect with a current access token.",
                },
              });
              return;
            }
            if (!body || typeof body !== "object" || Array.isArray(body))
              throw new DomainError(
                "INVALID_INPUT",
                "Expected an object.",
                400,
              );
            const data = await handler(body as Record<string, unknown>);
            reply({ ok: true, data });
          } catch (error) {
            reply({
              ok: false,
              error:
                error instanceof DomainError
                  ? { code: error.code, message: error.message }
                  : {
                      code: "INTERNAL_ERROR",
                      message: "Unable to process socket event.",
                    },
            });
          }
        });
      const id = (body: Record<string, unknown>, keys: string[]) => {
        if (
          Object.keys(body).some((k) => !keys.includes(k)) ||
          typeof body.conversationId !== "string" ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            body.conversationId,
          )
        )
          throw new DomainError(
            "INVALID_INPUT",
            "Provide a valid conversationId and documented fields.",
            400,
          );
        return body.conversationId;
      };
      action("conversation.join", async (body) => {
        const cid = id(body, ["conversationId"]);
        const conversation = await this.collaboration.conversation(
          socket.data.userId,
          cid,
        );
        if (socket.rooms.size >= 51 && !socket.rooms.has(`conversation:${cid}`))
          throw new DomainError(
            "ROOM_LIMIT",
            "Join up to 50 conversations.",
            429,
          );
        await socket.join(`conversation:${cid}`);
        return conversation;
      });
      action("conversation.leave", async (body) => {
        const cid = id(body, ["conversationId"]);
        await socket.leave(`conversation:${cid}`);
        return { conversationId: cid };
      });
      action("message.send", async (body) => {
        const cid = id(body, ["conversationId", "content"]);
        if (typeof body.content !== "string")
          throw new DomainError("INVALID_INPUT", "Provide text content.", 400);
        return this.collaboration.send(socket.data.userId, cid, body.content);
      });
      action("conversation.read", async (body) =>
        this.collaboration.readConversation(
          socket.data.userId,
          id(body, ["conversationId"]),
        ),
      );
    });
  }
  async onApplicationShutdown() {
    if (this.server)
      await new Promise<void>((resolve) => this.server!.close(() => resolve()));
  }
}
