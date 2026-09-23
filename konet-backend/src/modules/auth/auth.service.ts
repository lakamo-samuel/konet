import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { and, eq, gt, isNull } from "drizzle-orm";
import * as argon2 from "argon2";
import { createHash, randomUUID } from "crypto";
import { DATABASE, Database } from "../../database/database.module";
import { campuses, sessions, users } from "../../database/schema";
import { DomainError } from "../../common/errors/domain.error";
import { LoginDto, RegisterDto } from "./dto/auth.dto";
const normalize = (email: string) => email.trim().toLowerCase();
const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
@Injectable()
export class AuthService {
  constructor(
    @Inject(DATABASE) private db: Database,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}
  private publicUser(user: typeof users.$inferSelect) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      universityId: user.universityId,
      campusId: user.campusId,
      studentVerificationStatus: user.studentVerificationStatus,
      accountStatus: user.accountStatus,
    };
  }
  async register(dto: RegisterDto, userAgent?: string) {
    const email = normalize(dto.email);
    const [existing] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (existing)
      throw new DomainError(
        "EMAIL_IN_USE",
        "An account already exists for this email.",
        409,
      );
    const [campus] = await this.db
      .select({ id: campuses.id })
      .from(campuses)
      .where(
        and(
          eq(campuses.id, dto.campusId),
          eq(campuses.universityId, dto.universityId),
          eq(campuses.isActive, true),
        ),
      )
      .limit(1);
    if (!campus)
      throw new DomainError(
        "INVALID_CAMPUS",
        "The selected campus does not belong to this university.",
        422,
      );
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });
    const [user] = await this.db
      .insert(users)
      .values({ ...dto, email, passwordHash })
      .returning();
    return this.issueSession(user, userAgent);
  }
  async login(dto: LoginDto, userAgent?: string) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, normalize(dto.email)))
      .limit(1);
    if (!user || !(await argon2.verify(user.passwordHash, dto.password)))
      throw new DomainError(
        "INVALID_CREDENTIALS",
        "Email or password is incorrect.",
        401,
      );
    if (user.accountStatus !== "active")
      throw new DomainError(
        "ACCOUNT_UNAVAILABLE",
        "This account is not active.",
        403,
      );
    return this.issueSession(user, userAgent);
  }
  private async issueSession(
    user: typeof users.$inferSelect,
    userAgent?: string,
  ) {
    const sessionId = randomUUID();
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, sid: sessionId, type: "refresh" },
      {
        secret: this.config.getOrThrow("JWT_REFRESH_SECRET"),
        expiresIn: `${this.config.get<number>("REFRESH_TOKEN_TTL_DAYS", 30)}d`,
      },
    );
    const expiresAt = new Date(
      Date.now() +
        this.config.get<number>("REFRESH_TOKEN_TTL_DAYS", 30) * 86400000,
    );
    await this.db
      .insert(sessions)
      .values({
        id: sessionId,
        userId: user.id,
        refreshTokenHash: hashToken(refreshToken),
        expiresAt,
        userAgent,
      });
    const accessToken = await this.jwt.signAsync(
      { userId: user.id, email: user.email },
      {
        secret: this.config.getOrThrow("JWT_ACCESS_SECRET"),
        expiresIn: (this.config.get<string>("ACCESS_TOKEN_TTL") ??
          "15m") as import("jsonwebtoken").SignOptions["expiresIn"],
      },
    );
    return {
      accessToken,
      refreshToken,
      refreshExpiresAt: expiresAt,
      user: this.publicUser(user),
    };
  }
  async refresh(token: string, userAgent?: string) {
    let payload: { sub: string; sid: string; type: string };
    try {
      payload = await this.jwt.verifyAsync(token, {
        secret: this.config.getOrThrow("JWT_REFRESH_SECRET"),
      });
    } catch {
      throw new DomainError(
        "INVALID_REFRESH_TOKEN",
        "Refresh session is invalid or expired.",
        401,
      );
    }
    const [session] = await this.db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.id, payload.sid),
          eq(sessions.refreshTokenHash, hashToken(token)),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, new Date()),
        ),
      )
      .limit(1);
    if (!session) {
      await this.db
        .update(sessions)
        .set({ revokedAt: new Date() })
        .where(eq(sessions.id, payload.sid));
      throw new DomainError(
        "REFRESH_TOKEN_REUSED",
        "This session is no longer valid.",
        401,
      );
    }
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.id, session.id));
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);
    if (!user)
      throw new DomainError("USER_NOT_FOUND", "Account not found.", 401);
    return this.issueSession(user, userAgent);
  }
  async logout(token?: string) {
    if (!token) return;
    try {
      const payload = await this.jwt.verifyAsync<{ sid: string }>(token, {
        secret: this.config.getOrThrow("JWT_REFRESH_SECRET"),
      });
      await this.db
        .update(sessions)
        .set({ revokedAt: new Date() })
        .where(eq(sessions.id, payload.sid));
    } catch {
      return;
    }
  }
  async me(userId: string) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user)
      throw new DomainError("USER_NOT_FOUND", "Account not found.", 404);
    return this.publicUser(user);
  }
  async forgotPassword(_email: string) {
    return {
      message:
        "If an account exists, password recovery instructions will be sent.",
    };
  }
}
