import { STAFF_MFA_LIFETIME_MS } from "./staff-mfa-policy";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, eq, gt, isNull } from "drizzle-orm";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import * as argon2 from "argon2";
import { Secret, TOTP } from "otpauth";
import { DATABASE, Database } from "../../database/database.module";
import {
  sessions,
  staffAuthenticators,
  users,
  auditEvents,
} from "../../database/schema";
import { DomainError } from "../../common/errors/domain.error";
import { AuthUser } from "../../common/decorators/current-user.decorator";

const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
@Injectable()
export class StaffSecurityService {
  constructor(
    @Inject(DATABASE) private db: Database,
    private config: ConfigService,
  ) {}
  private key() {
    const key = this.config.get<string>("STAFF_MFA_ENCRYPTION_KEY") ?? "";
    if (!/^[a-f\d]{64}$/i.test(key))
      throw new DomainError(
        "STAFF_MFA_NOT_CONFIGURED",
        "Staff security is not configured. Contact the server operator.",
        503,
      );
    return Buffer.from(key, "hex");
  }
  private encrypt(secret: string, userId: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key(), iv);
    cipher.setAAD(Buffer.from(userId));
    const data = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
  }
  private decrypt(value: string, userId: string) {
    const packed = Buffer.from(value, "base64");
    const cipher = createDecipheriv(
      "aes-256-gcm",
      this.key(),
      packed.subarray(0, 12),
    );
    cipher.setAAD(Buffer.from(userId));
    cipher.setAuthTag(packed.subarray(12, 28));
    return Buffer.concat([
      cipher.update(packed.subarray(28)),
      cipher.final(),
    ]).toString("utf8");
  }
  private otp(secret: string, email: string) {
    return new TOTP({
      issuer: "Konet",
      label: email,
      secret,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
    });
  }
  async status(user: AuthUser) {
    const [factor] = await this.db
      .select()
      .from(staffAuthenticators)
      .where(eq(staffAuthenticators.userId, user.userId));
    const [session] = await this.db
      .select({ verifiedAt: sessions.staffMfaVerifiedAt })
      .from(sessions)
      .where(eq(sessions.id, user.sid));
    const expiresAt = session?.verifiedAt
      ? new Date(session.verifiedAt.getTime() + STAFF_MFA_LIFETIME_MS)
      : null;
    return {
      enabled: Boolean(factor?.confirmedAt),
      verified: Boolean(
        factor?.confirmedAt && expiresAt && expiresAt > new Date(),
      ),
      expiresAt,
      recoveryCodesRemaining: factor?.recoveryHashes.length ?? 0,
    };
  }
  async enroll(user: AuthUser, password: string) {
    this.key();
    const result = await this.db.transaction(async (tx) => {
      await tx
        .insert(staffAuthenticators)
        .values({ userId: user.userId })
        .onConflictDoNothing();
      const [factor] = await tx
        .select()
        .from(staffAuthenticators)
        .where(eq(staffAuthenticators.userId, user.userId))
        .for("update");
      if (factor.lockedUntil && factor.lockedUntil > new Date())
        return { error: "STAFF_MFA_RATE_LIMIT" };
      if (factor.confirmedAt)
        throw new DomainError(
          "STAFF_MFA_ALREADY_ENABLED",
          "An authenticator is already enrolled. Use your authenticator or a recovery code.",
          409,
        );
      const [account] = await tx
        .select({ passwordHash: users.passwordHash })
        .from(users)
        .where(
          and(eq(users.id, user.userId), eq(users.accountStatus, "active")),
        );
      if (!account || !(await argon2.verify(account.passwordHash, password))) {
        const attempts = factor.attempts + 1;
        await tx
          .update(staffAuthenticators)
          .set({
            attempts: attempts >= 5 ? 0 : attempts,
            lockedUntil: attempts >= 5 ? new Date(Date.now() + 900_000) : null,
          })
          .where(eq(staffAuthenticators.userId, user.userId));
        return { error: "INVALID_PASSWORD" };
      }
      const secret = new Secret({ size: 20 }).base32;
      const expiresAt = new Date(Date.now() + 600_000);
      await tx
        .update(staffAuthenticators)
        .set({
          pendingCiphertext: this.encrypt(secret, user.userId),
          pendingExpiresAt: expiresAt,
        })
        .where(eq(staffAuthenticators.userId, user.userId));
      await tx
        .insert(auditEvents)
        .values({
          actorId: user.userId,
          action: "staff_mfa.enrollment_started",
          resourceType: "user",
          resourceId: user.userId,
          details: {},
        });
      return {
        secret,
        uri: this.otp(secret, user.email).toString(),
        expiresAt,
      };
    });
    if ("error" in result)
      throw new DomainError(
        result.error!,
        result.error === "INVALID_PASSWORD"
          ? "Current password is incorrect."
          : "Too many attempts. Try again in 15 minutes.",
        result.error === "INVALID_PASSWORD" ? 401 : 429,
      );
    return result;
  }
  async verify(user: AuthUser, code: string, confirm = false) {
    this.key();
    const result = await this.db.transaction(async (tx) => {
      const [factor] = await tx
        .select()
        .from(staffAuthenticators)
        .where(eq(staffAuthenticators.userId, user.userId))
        .for("update");
      if (!factor) return { error: "STAFF_MFA_ENROLLMENT_REQUIRED" };
      if (factor.lockedUntil && factor.lockedUntil > new Date())
        return { error: "STAFF_MFA_RATE_LIMIT" };
      const ciphertext = confirm
        ? !factor.confirmedAt &&
          factor.pendingExpiresAt &&
          factor.pendingExpiresAt > new Date()
          ? factor.pendingCiphertext
          : null
        : factor.secretCiphertext;
      if (!ciphertext) return { error: "STAFF_MFA_ENROLLMENT_REQUIRED" };
      const recoveryIndex = confirm
        ? -1
        : factor.recoveryHashes.indexOf(hash(code.trim()));
      const timestamp = Date.now();
      const delta = /^\d{6}$/.test(code)
        ? this.otp(this.decrypt(ciphertext, user.userId), user.email).validate({
            token: code,
            window: 1,
            timestamp,
          })
        : null;
      const step =
        delta === null ? null : Math.floor(timestamp / 30_000) + delta;
      const valid =
        recoveryIndex >= 0 ||
        (step !== null &&
          (factor.lastUsedStep === null || step > factor.lastUsedStep));
      if (!valid) {
        const attempts = factor.attempts + 1;
        await tx
          .update(staffAuthenticators)
          .set({
            attempts: attempts >= 5 ? 0 : attempts,
            lockedUntil: attempts >= 5 ? new Date(timestamp + 900_000) : null,
          })
          .where(eq(staffAuthenticators.userId, user.userId));
        return { error: "INVALID_STAFF_MFA_CODE" };
      }
      const now = new Date(timestamp);
      const updated = await tx
        .update(sessions)
        .set({ staffMfaVerifiedAt: now })
        .where(
          and(
            eq(sessions.id, user.sid),
            eq(sessions.userId, user.userId),
            isNull(sessions.revokedAt),
            gt(sessions.expiresAt, now),
          ),
        )
        .returning({ id: sessions.id });
      if (!updated.length)
        throw new DomainError("SESSION_UNAVAILABLE", "Sign in again.", 401);
      const recoveryCodes = confirm
        ? Array.from({ length: 10 }, () => randomBytes(16).toString("hex"))
        : undefined;
      await tx
        .update(staffAuthenticators)
        .set({
          secretCiphertext: confirm ? ciphertext : factor.secretCiphertext,
          confirmedAt: factor.confirmedAt ?? now,
          pendingCiphertext: null,
          pendingExpiresAt: null,
          lastUsedStep: recoveryIndex >= 0 ? factor.lastUsedStep : step,
          attempts: 0,
          lockedUntil: null,
          recoveryHashes: recoveryCodes
            ? recoveryCodes.map(hash)
            : factor.recoveryHashes.filter(
                (_, index) => index !== recoveryIndex,
              ),
        })
        .where(eq(staffAuthenticators.userId, user.userId));
      await tx
        .insert(auditEvents)
        .values({
          actorId: user.userId,
          action: confirm ? "staff_mfa.enrolled" : "staff_mfa.verified",
          resourceType: "user",
          resourceId: user.userId,
          details: {
            method: recoveryIndex >= 0 ? "recovery_code" : "authenticator",
          },
        });
      return {
        verified: true,
        expiresAt: new Date(timestamp + STAFF_MFA_LIFETIME_MS),
        ...(recoveryCodes ? { recoveryCodes } : {}),
      };
    });
    if ("error" in result)
      throw new DomainError(
        result.error!,
        result.error === "STAFF_MFA_RATE_LIMIT"
          ? "Too many attempts. Try again in 15 minutes."
          : "Use a fresh authenticator code or unused recovery code.",
        result.error === "STAFF_MFA_RATE_LIMIT" ? 429 : 422,
      );
    return result;
  }
}
