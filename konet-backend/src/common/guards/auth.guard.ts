import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { and, eq, gt, isNull } from "drizzle-orm";
import { DATABASE, Database } from "../../database/database.module";
import { sessions, users } from "../../database/schema";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwt: JwtService,
    private config: ConfigService,
    @Inject(DATABASE) private db: Database,
  ) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const header = String(request.headers.authorization ?? "");
    const token = /^Bearer\s+(\S+)$/i.exec(header)?.[1];
    if (!token) throw new UnauthorizedException("Authentication required");
    let payload: { userId: string; email: string; sid: string; type: string };
    try {
      payload = await this.jwt.verifyAsync(token, {
        secret: this.config.getOrThrow("JWT_ACCESS_SECRET"),
      });
      if (
        payload.type !== "access" ||
        typeof payload.userId !== "string" ||
        typeof payload.sid !== "string"
      )
        throw new Error("Invalid payload");
    } catch {
      throw new UnauthorizedException("Invalid or expired access token");
    }
    const [session] = await this.db
      .select({ accountStatus: users.accountStatus })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
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
    if (!session)
      throw new UnauthorizedException(
        "Session is revoked, expired, or unavailable",
      );
    request.user = payload;
    return true;
  }
}
