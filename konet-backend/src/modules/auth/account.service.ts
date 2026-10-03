import {
  assertNoAccountObligations,
  revokeAccountAccess,
} from "./account-access-policy";
import {
  lockStaffRoles,
  preserveActiveAdministrator,
} from "../administration/staff-role-policy";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, desc, eq, gte, inArray, isNull, like, sql } from "drizzle-orm";
import {
  createHash,
  createHmac,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import * as argon2 from "argon2";
import { DATABASE, Database } from "../../database/database.module";
import * as s from "../../database/schema";
import { DomainError } from "../../common/errors/domain.error";
import { EmailService } from "../../infrastructure/email/email.service";
import {
  ProfileInput,
  EmailChangeInput,
  ConfirmChallengeInput,
} from "../contracts/contract.dto";
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
const fingerprint = (value: string) =>
  createHash("sha256").update(value).digest("hex");
@Injectable()
export class AccountService {
  constructor(
    @Inject(DATABASE) private db: Database,
    private config: ConfigService,
    private email: EmailService,
  ) {}
  private fail(code: string, message: string, status = 409): never {
    throw new DomainError(code, message, status);
  }
  private view(u: typeof s.users.$inferSelect) {
    const { passwordHash: _passwordHash, ...out } = u;
    return out;
  }
  private async user(tx: Tx, id: string) {
    const [u] = await tx
      .select()
      .from(s.users)
      .where(eq(s.users.id, id))
      .for("no key update");
    if (!u || u.accountStatus !== "active")
      this.fail("ACCOUNT_UNAVAILABLE", "Account unavailable.", 401);
    return u;
  }
  async profile(userId: string, input: ProfileInput) {
    if (!Object.values(input).some((v) => v !== undefined))
      this.fail("EMPTY_PROFILE", "Provide at least one profile field.", 422);
    if (
      input.fullName !== undefined &&
      (input.fullName.trim().length < 2 || input.fullName.length > 150)
    )
      this.fail(
        "INVALID_NAME",
        "Full name must contain 2–150 characters.",
        422,
      );
    return this.db.transaction(async (tx) => {
      const u = await this.user(tx, userId);
      const universityId = input.universityId ?? u.universityId;
      const campusId = input.campusId ?? u.campusId;
      const moved = universityId !== u.universityId || campusId !== u.campusId;
      const [campus] = await tx
        .select({ id: s.campuses.id })
        .from(s.campuses)
        .innerJoin(
          s.universities,
          eq(s.universities.id, s.campuses.universityId),
        )
        .where(
          and(
            eq(s.campuses.id, campusId),
            eq(s.campuses.universityId, universityId),
            eq(s.campuses.isActive, true),
            eq(s.universities.isActive, true),
          ),
        )
        .for("share");
      if (!campus)
        this.fail(
          "INVALID_CAMPUS",
          "Select an active campus belonging to the university.",
          422,
        );
      if (moved) {
        await assertNoAccountObligations(tx, userId);
        await tx
          .update(s.verificationChallenges)
          .set({ consumedAt: new Date() })
          .where(
            and(
              eq(s.verificationChallenges.userId, userId),
              isNull(s.verificationChallenges.consumedAt),
            ),
          );
        await tx
          .update(s.studentVerifications)
          .set({ status: "requires_more_information" })
          .where(
            and(
              eq(s.studentVerifications.userId, userId),
              eq(s.studentVerifications.status, "pending"),
            ),
          );
        await tx
          .update(s.emailOutbox)
          .set({
            status: "cancelled",
            payloadCiphertext: null,
            leaseUntil: null,
          })
          .where(
            and(
              eq(s.emailOutbox.userId, userId),
              inArray(s.emailOutbox.status, ["pending", "sending"]),
              like(s.emailOutbox.idempotencyKey, "student-verification:%"),
            ),
          );
        await tx
          .update(s.providerProfiles)
          .set({
            status: sql`CASE WHEN ${s.providerProfiles.status} = 'suspended' THEN 'suspended'::provider_status ELSE 'draft'::provider_status END`,
            reviewStatus: "not_submitted",
            reviewRevision: sql`${s.providerProfiles.reviewRevision} + 1`,
            approvedAt: null,
            reviewedAt: null,
            reviewReason: null,
            submittedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(s.providerProfiles.userId, userId));
      }
      const [out] = await tx
        .update(s.users)
        .set({
          fullName: input.fullName?.trim(),
          avatarUrl: input.avatarUrl,
          universityId,
          campusId,
          studentVerificationStatus: moved
            ? "unverified"
            : u.studentVerificationStatus,
          updatedAt: new Date(),
        })
        .where(eq(s.users.id, userId))
        .returning();
      await tx.insert(s.auditEvents).values({
        actorId: userId,
        action: "account.profile_updated",
        resourceType: "user",
        resourceId: userId,
        details: { fields: Object.keys(input), affiliationChanged: moved },
      });
      return this.view(out);
    });
  }
  private codeHash(id: string, code: string) {
    return createHmac(
      "sha256",
      this.config.getOrThrow<string>("JWT_REFRESH_SECRET"),
    )
      .update(`email-change:${id}:${code}`)
      .digest("hex");
  }
  async requestEmail(userId: string, input: EmailChangeInput) {
    this.email.requireConfigured();
    const address = input.email.trim().toLowerCase();
    if (address.length > 255)
      this.fail("INVALID_EMAIL", "Email is too long.", 422);
    return this.db.transaction(async (tx) => {
      const u = await this.user(tx, userId);
      if (!(await argon2.verify(u.passwordHash, input.password)))
        this.fail("INVALID_PASSWORD", "Current password is incorrect.", 401);
      await assertNoAccountObligations(tx, userId);
      if (address === u.email)
        this.fail("EMAIL_UNCHANGED", "Choose a different email.", 422);
      const [used] = await tx
        .select({ id: s.users.id })
        .from(s.users)
        .where(eq(s.users.email, address));
      if (used) this.fail("EMAIL_UNAVAILABLE", "This email cannot be used.");
      const now = new Date();
      const recent = await tx
        .select()
        .from(s.emailChangeChallenges)
        .where(
          and(
            eq(s.emailChangeChallenges.userId, userId),
            gte(
              s.emailChangeChallenges.createdAt,
              new Date(now.getTime() - 3600000),
            ),
          ),
        )
        .orderBy(desc(s.emailChangeChallenges.createdAt))
        .limit(3);
      if (
        recent.length >= 3 ||
        (recent[0] && now.getTime() - recent[0].createdAt.getTime() < 60000)
      )
        this.fail(
          "EMAIL_CHANGE_RATE_LIMIT",
          "Wait before requesting another email change.",
          429,
        );
      await tx
        .update(s.emailChangeChallenges)
        .set({ consumedAt: now })
        .where(
          and(
            eq(s.emailChangeChallenges.userId, userId),
            isNull(s.emailChangeChallenges.consumedAt),
          ),
        );
      await tx
        .update(s.emailOutbox)
        .set({ status: "cancelled", payloadCiphertext: null, leaseUntil: null })
        .where(
          and(
            eq(s.emailOutbox.userId, userId),
            inArray(s.emailOutbox.status, ["pending", "sending"]),
            like(s.emailOutbox.idempotencyKey, "email-change:%"),
          ),
        );
      const id = randomUUID();
      const code = randomInt(0, 1000000).toString().padStart(6, "0");
      const expiresAt = new Date(now.getTime() + 600000);
      await tx.insert(s.emailChangeChallenges).values({
        id,
        userId,
        currentEmail: u.email,
        email: address,
        passwordFingerprint: fingerprint(u.passwordHash),
        codeHash: this.codeHash(id, code),
        expiresAt,
      });
      await tx.insert(s.emailOutbox).values({
        userId,
        idempotencyKey: `email-change:${id}`,
        expiresAt,
        payloadCiphertext: this.email.encrypt({
          to: address,
          subject: "Confirm your new Konet email",
          text: `Your Konet email change code is ${code}. It expires in 10 minutes and can be used once. Do not share it. If you did not request this change, ignore this email. Your account email has not changed.`,
        }),
      });
      await tx.insert(s.auditEvents).values({
        actorId: userId,
        action: "account.email_change_requested",
        resourceType: "user",
        resourceId: userId,
        details: { challengeId: id },
      });
      return {
        challengeId: id,
        expiresAt,
        resendAfter: new Date(now.getTime() + 60000),
      };
    });
  }
  async confirmEmail(userId: string, input: ConfirmChallengeInput) {
    this.email.requireConfigured();
    let result:
      { error: string } | { user: ReturnType<AccountService["view"]> };
    try {
      result = await this.db.transaction(async (tx) => {
        const u = await this.user(tx, userId);
        const [c] = await tx
          .select()
          .from(s.emailChangeChallenges)
          .where(
            and(
              eq(s.emailChangeChallenges.id, input.challengeId),
              eq(s.emailChangeChallenges.userId, userId),
            ),
          )
          .for("update");
        if (
          !c ||
          c.consumedAt ||
          c.expiresAt <= new Date() ||
          c.attempts >= 5 ||
          c.currentEmail !== u.email ||
          c.passwordFingerprint !== fingerprint(u.passwordHash)
        )
          return {
            error: "Email change code is invalid, expired or already used.",
          };
        const valid =
          /^\d{6}$/.test(input.code) &&
          timingSafeEqual(
            Buffer.from(c.codeHash, "hex"),
            Buffer.from(this.codeHash(c.id, input.code), "hex"),
          );
        await tx
          .update(s.emailChangeChallenges)
          .set({
            attempts: c.attempts + 1,
            consumedAt: valid || c.attempts + 1 >= 5 ? new Date() : null,
          })
          .where(eq(s.emailChangeChallenges.id, c.id));
        if (!valid)
          return {
            error: "Email change code is invalid, expired or already used.",
          };
        await assertNoAccountObligations(tx, userId);
        const [used] = await tx
          .select({ id: s.users.id })
          .from(s.users)
          .where(eq(s.users.email, c.email));
        if (used) this.fail("EMAIL_UNAVAILABLE", "This email cannot be used.");
        const [out] = await tx
          .update(s.users)
          .set({
            email: c.email,
            emailVerifiedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(s.users.id, userId))
          .returning();
        await revokeAccountAccess(tx, userId);
        await tx.insert(s.emailOutbox).values({
          userId,
          idempotencyKey: `email-changed-alert:${c.id}`,
          expiresAt: new Date(Date.now() + 86400000),
          payloadCiphertext: this.email.encrypt({
            to: u.email,
            subject: "Your Konet account email changed",
            text: "Your Konet account email has been changed. Existing sessions have been signed out. If you did not authorize this change, contact Konet support immediately.",
          }),
        });
        await tx.insert(s.auditEvents).values({
          actorId: userId,
          action: "account.email_changed",
          resourceType: "user",
          resourceId: userId,
          details: { challengeId: c.id },
        });
        return { user: this.view(out) };
      });
    } catch (error) {
      if (
        (error as { cause?: { code?: string } }).cause?.code === "23505" ||
        (error as { code?: string }).code === "23505"
      )
        this.fail("EMAIL_UNAVAILABLE", "This email cannot be used.");
      throw error;
    }
    if ("error" in result)
      this.fail("INVALID_EMAIL_CHANGE_CODE", result.error, 422);
    return result.user;
  }
  async deactivate(userId: string, reason: string) {
    if (reason.trim().length < 3 || reason.length > 2000)
      this.fail(
        "INVALID_REASON",
        "Provide a reason of 3–2000 characters.",
        422,
      );
    await this.db.transaction(async (tx) => {
      await lockStaffRoles(tx);
      await this.user(tx, userId);
      await preserveActiveAdministrator(tx, userId);
      await assertNoAccountObligations(tx, userId);
      await tx
        .update(s.users)
        .set({ accountStatus: "deactivated", updatedAt: new Date() })
        .where(eq(s.users.id, userId));
      await tx
        .update(s.providerProfiles)
        .set({
          status: sql`CASE WHEN ${s.providerProfiles.status} = 'suspended' THEN 'suspended'::provider_status ELSE 'draft'::provider_status END`,
          updatedAt: new Date(),
        })
        .where(eq(s.providerProfiles.userId, userId));
      await revokeAccountAccess(tx, userId);
      await tx
        .update(s.verificationChallenges)
        .set({ consumedAt: new Date() })
        .where(
          and(
            eq(s.verificationChallenges.userId, userId),
            isNull(s.verificationChallenges.consumedAt),
          ),
        );
      await tx.insert(s.auditEvents).values({
        actorId: userId,
        action: "account.deactivated",
        resourceType: "user",
        resourceId: userId,
        reason: reason.trim(),
        details: {},
      });
    });
  }
}
