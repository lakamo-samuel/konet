import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { and, desc, eq, gt, gte, isNull, like } from "drizzle-orm";
import * as argon2 from "argon2";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { DATABASE, Database } from "../../database/database.module";
import {
  campuses,
  emailOutbox,
  passwordResetTokens,
  sessions,
  universities,
  users,
  userRoles,
} from "../../database/schema";
import { DomainError } from "../../common/errors/domain.error";
import { EmailService } from "../../infrastructure/email/email.service";
import { LoginDto, RegisterDto } from "./dto/auth.dto";

const normalize = (email: string) => email.trim().toLowerCase();
const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
type Executor = Pick<Database, "select" | "insert" | "update">;
type RefreshPayload = { sub: string; sid: string; type: string };
const recoveryAcknowledgement = {
  message: "If an account exists, password recovery instructions will be sent.",
};

@Injectable()
export class AuthService {
  constructor(
    @Inject(DATABASE) private db: Database,
    private jwt: JwtService,
    private config: ConfigService,
    private email: EmailService,
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
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });
    try {
      return await this.db.transaction(async (tx) => {
        const [campus] = await tx
          .select({ id: campuses.id })
          .from(campuses)
          .innerJoin(universities, eq(campuses.universityId, universities.id))
          .where(
            and(
              eq(campuses.id, dto.campusId),
              eq(campuses.universityId, dto.universityId),
              eq(campuses.isActive, true),
              eq(universities.isActive, true),
            ),
          )
          .limit(1);
        if (!campus)
          throw new DomainError(
            "INVALID_CAMPUS",
            "Select an active university and a campus belonging to it.",
            422,
          );
        const [user] = await tx
          .insert(users)
          .values({
            email,
            fullName: dto.fullName,
            universityId: dto.universityId,
            campusId: dto.campusId,
            passwordHash,
          })
          .returning();
        return this.issueSession(tx, user, userAgent);
      });
    } catch (error) {
      const cause = error as {
        code?: string;
        cause?: { code?: string; constraint?: string };
        constraint?: string;
      };
      if (
        (cause.code ?? cause.cause?.code) === "23505" &&
        (cause.constraint ?? cause.cause?.constraint) === "users_email_uq"
      )
        throw new DomainError(
          "EMAIL_IN_USE",
          "An account already exists for this email.",
          409,
        );
      throw error;
    }
  }
  async login(dto: LoginDto, userAgent?: string) {
    return this.db.transaction(async (tx) => {
      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.email, normalize(dto.email)))
        .limit(1)
        .for("update");
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
      return this.issueSession(tx, user, userAgent);
    });
  }
  private async issueSession(
    db: Executor,
    user: typeof users.$inferSelect,
    userAgent?: string,
    familyId: string = randomUUID(),
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
    await db.insert(sessions).values({
      id: sessionId,
      familyId,
      userId: user.id,
      refreshTokenHash: hashToken(refreshToken),
      expiresAt,
      userAgent,
    });
    const accessToken = await this.jwt.signAsync(
      { userId: user.id, email: user.email, sid: sessionId, type: "access" },
      {
        secret: this.config.getOrThrow("JWT_ACCESS_SECRET"),
        expiresIn: this.config.get<string>(
          "ACCESS_TOKEN_TTL",
          "15m",
        ) as import("jsonwebtoken").SignOptions["expiresIn"],
      },
    );
    return {
      accessToken,
      refreshToken,
      refreshExpiresAt: expiresAt,
      user: this.publicUser(user),
    };
  }
  private async decodeRefresh(token: string): Promise<RefreshPayload> {
    try {
      const payload = await this.jwt.verifyAsync<RefreshPayload>(token, {
        secret: this.config.getOrThrow("JWT_REFRESH_SECRET"),
      });
      if (
        payload.type !== "refresh" ||
        typeof payload.sub !== "string" ||
        typeof payload.sid !== "string"
      )
        throw new Error("Invalid payload");
      return payload;
    } catch {
      throw new DomainError(
        "INVALID_REFRESH_TOKEN",
        "Refresh session is invalid or expired.",
        401,
      );
    }
  }
  async refresh(token: string, userAgent?: string) {
    const payload = await this.decodeRefresh(token);
    // Always lock account before session; password changes use the same lock order.
    const result = await this.db.transaction(async (tx) => {
      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.id, payload.sub))
        .limit(1)
        .for("update");
      const [session] = await tx
        .select()
        .from(sessions)
        .where(
          and(
            eq(sessions.id, payload.sid),
            eq(sessions.userId, payload.sub),
            eq(sessions.refreshTokenHash, hashToken(token)),
          ),
        )
        .limit(1)
        .for("update");
      if (!session || !user || session.expiresAt <= new Date())
        return new DomainError(
          "INVALID_REFRESH_TOKEN",
          "Refresh session is invalid or expired.",
          401,
        );
      if (session.revokedAt) {
        await tx
          .update(sessions)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(sessions.familyId, session.familyId),
              isNull(sessions.revokedAt),
            ),
          );
        // Return instead of throwing so family revocation commits.
        return new DomainError(
          "REFRESH_TOKEN_REUSED",
          "This session is no longer valid. Sign in again.",
          401,
        );
      }
      if (user.accountStatus !== "active") {
        await tx
          .update(sessions)
          .set({ revokedAt: new Date() })
          .where(eq(sessions.userId, user.id));
        return new DomainError(
          "ACCOUNT_UNAVAILABLE",
          "This account is not active.",
          403,
        );
      }
      await tx
        .update(sessions)
        .set({ revokedAt: new Date() })
        .where(eq(sessions.id, session.id));
      return this.issueSession(tx, user, userAgent, session.familyId);
    });
    if (result instanceof DomainError) throw result;
    return result;
  }
  async logout(token?: string) {
    if (!token) return;
    let payload: RefreshPayload;
    try {
      payload = await this.decodeRefresh(token);
    } catch {
      return;
    }
    await this.db.transaction(async (tx) => {
      await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, payload.sub))
        .limit(1)
        .for("update");
      const [session] = await tx
        .select()
        .from(sessions)
        .where(
          and(
            eq(sessions.id, payload.sid),
            eq(sessions.userId, payload.sub),
            eq(sessions.refreshTokenHash, hashToken(token)),
          ),
        )
        .limit(1);
      if (session)
        await tx
          .update(sessions)
          .set({ revokedAt: new Date() })
          .where(eq(sessions.familyId, session.familyId));
    });
  }
  async me(userId: string) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user)
      throw new DomainError("USER_NOT_FOUND", "Account not found.", 404);
    const roles = await this.db
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(eq(userRoles.userId, userId))
      .orderBy(userRoles.role);
    return { ...this.publicUser(user), roles: roles.map((row) => row.role) };
  }
  async forgotPassword(email: string) {
    // Same configuration failure and acknowledgement for existing and unknown accounts.
    this.email.requireConfigured();
    const base =
      this.config.get<string>("PASSWORD_RESET_URL") ??
      `${this.config.getOrThrow<string>("FRONTEND_URL").split(",")[0].replace(/\/$/, "")}/reset-password`;
    await this.db.transaction(async (tx) => {
      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.email, normalize(email)))
        .limit(1)
        .for("update");
      if (!user || user.accountStatus !== "active") return;
      const now = new Date();
      const recent = await tx
        .select({ createdAt: passwordResetTokens.createdAt })
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.userId, user.id),
            gte(
              passwordResetTokens.createdAt,
              new Date(now.getTime() - 3600000),
            ),
          ),
        )
        .orderBy(desc(passwordResetTokens.createdAt))
        .limit(3);
      if (
        recent.length >= 3 ||
        (recent[0] && now.getTime() - recent[0].createdAt.getTime() < 60000)
      )
        return;
      const token = randomBytes(32).toString("base64url");
      const expiresAt = new Date(now.getTime() + 30 * 60000);
      await this.cancelRecoveryEmails(tx, user.id);
      await tx
        .update(passwordResetTokens)
        .set({ consumedAt: now })
        .where(
          and(
            eq(passwordResetTokens.userId, user.id),
            isNull(passwordResetTokens.consumedAt),
          ),
        );
      const [reset] = await tx
        .insert(passwordResetTokens)
        .values({
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt,
          createdAt: now,
        })
        .returning();
      const resetUrl = new URL(base);
      // Fragment avoids putting the secret in HTTP request URLs and access logs.
      resetUrl.hash = `token=${token}`;
      const payloadCiphertext = this.email.encrypt({
        to: user.email,
        subject: "Reset your Konet password",
        text: `Reset your Konet password using this link:\n\n${resetUrl.toString()}\n\nThis link expires in 30 minutes and can be used once. If you did not request it, ignore this email. Your password has not changed.`,
      });
      await tx.insert(emailOutbox).values({
        userId: user.id,
        payloadCiphertext,
        idempotencyKey: `password-reset:${reset.id}`,
        expiresAt,
      });
    });
    return recoveryAcknowledgement;
  }
  async resetPassword(token: string, password: string) {
    const [candidate] = await this.db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.tokenHash, hashToken(token)),
          isNull(passwordResetTokens.consumedAt),
          gt(passwordResetTokens.expiresAt, new Date()),
        ),
      )
      .limit(1);
    if (!candidate)
      throw new DomainError(
        "INVALID_RESET_TOKEN",
        "Password reset link is invalid, expired, or already used.",
        400,
      );
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    await this.db.transaction(async (tx) => {
      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.id, candidate.userId))
        .limit(1)
        .for("update");
      if (!user || user.accountStatus !== "active")
        throw new DomainError(
          "INVALID_RESET_TOKEN",
          "Password reset link is invalid, expired, or already used.",
          400,
        );
      const [consumed] = await tx
        .update(passwordResetTokens)
        .set({ consumedAt: new Date() })
        .where(
          and(
            eq(passwordResetTokens.id, candidate.id),
            isNull(passwordResetTokens.consumedAt),
            gt(passwordResetTokens.expiresAt, new Date()),
          ),
        )
        .returning();
      if (!consumed)
        throw new DomainError(
          "INVALID_RESET_TOKEN",
          "Password reset link is invalid, expired, or already used.",
          400,
        );
      await this.replacePassword(tx, user.id, passwordHash);
    });
    return { message: "Password reset. Sign in with your new password." };
  }
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const passwordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
    });
    await this.db.transaction(async (tx) => {
      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
        .for("update");
      if (
        !user ||
        user.accountStatus !== "active" ||
        !(await argon2.verify(user.passwordHash, currentPassword))
      )
        throw new DomainError(
          "INVALID_CREDENTIALS",
          "Current password is incorrect or the account is unavailable.",
          401,
        );
      await this.replacePassword(tx, user.id, passwordHash);
    });
    return { message: "Password changed. Sign in again." };
  }
  private async replacePassword(
    tx: Executor,
    userId: string,
    passwordHash: string,
  ) {
    const now = new Date();
    await tx
      .update(users)
      .set({ passwordHash, updatedAt: now })
      .where(eq(users.id, userId));
    await tx
      .update(sessions)
      .set({ revokedAt: now })
      .where(eq(sessions.userId, userId));
    await tx
      .update(passwordResetTokens)
      .set({ consumedAt: now })
      .where(
        and(
          eq(passwordResetTokens.userId, userId),
          isNull(passwordResetTokens.consumedAt),
        ),
      );
    await this.cancelRecoveryEmails(tx, userId);
  }
  private async cancelRecoveryEmails(tx: Executor, userId: string) {
    await tx
      .update(emailOutbox)
      .set({ status: "cancelled", payloadCiphertext: null, leaseUntil: null })
      .where(
        and(
          eq(emailOutbox.userId, userId),
          eq(emailOutbox.status, "pending"),
          like(emailOutbox.idempotencyKey, "password-reset:%"),
        ),
      );
  }
}
