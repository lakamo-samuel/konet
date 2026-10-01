import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, desc, eq, gt, inArray, isNull, like, ne } from "drizzle-orm";
import {
  createHmac,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { DATABASE, Database } from "../../database/database.module";
import {
  auditEvents,
  campuses,
  emailOutbox,
  notifications,
  studentVerifications,
  universities,
  universityEmailDomains,
  uploads,
  users,
  verificationChallenges,
  verificationDecisions,
} from "../../database/schema";
import { DomainError } from "../../common/errors/domain.error";
import { EmailService } from "../../infrastructure/email/email.service";
import {
  ConfirmChallengeInput,
  DecisionInput,
  EmailChallengeInput,
  StudentVerificationInput,
} from "../contracts/contract.dto";
import { VerificationQuery } from "./verifications.dto";
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Verification = typeof studentVerifications.$inferSelect;
@Injectable()
export class VerificationsService {
  constructor(
    @Inject(DATABASE) private db: Database,
    private config: ConfigService,
    private email: EmailService,
  ) {}
  private hash(value: string) {
    return createHmac(
      "sha256",
      this.config.getOrThrow<string>("JWT_REFRESH_SECRET"),
    )
      .update(`student-verification:${value}`)
      .digest("hex");
  }
  private view(
    row: Verification,
    reason: string | null = null,
    uploadId: string | null = null,
  ) {
    return {
      id: row.id,
      userId: row.userId,
      method: row.method,
      status: row.status,
      universityId: row.universityId,
      campusId: row.campusId,
      submittedAt: row.submittedAt,
      decidedAt: row.decidedAt,
      createdAt: row.createdAt,
      reason,
      uploadId,
    };
  }
  private async context(tx: Tx, userId: string) {
    const [user] = await tx
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .for("update");
    if (!user || user.accountStatus !== "active")
      throw new DomainError(
        "ACCOUNT_UNAVAILABLE",
        "Account is unavailable.",
        403,
      );
    const [university] = await tx
      .select()
      .from(universities)
      .where(
        and(
          eq(universities.id, user.universityId),
          eq(universities.isActive, true),
        ),
      )
      .limit(1);
    const [campus] = await tx
      .select()
      .from(campuses)
      .where(
        and(
          eq(campuses.id, user.campusId),
          eq(campuses.universityId, user.universityId),
          eq(campuses.isActive, true),
        ),
      )
      .limit(1);
    if (!university || !campus)
      throw new DomainError(
        "UNIVERSITY_UNAVAILABLE",
        "Select an active university and campus before verification.",
        409,
      );
    return user;
  }
  private async pending(tx: Tx, userId: string) {
    const [row] = await tx
      .select()
      .from(studentVerifications)
      .where(
        and(
          eq(studentVerifications.userId, userId),
          eq(studentVerifications.status, "pending"),
        ),
      )
      .limit(1);
    return row;
  }
  private async approvedDomain(tx: Tx, universityId: string, email: string) {
    const [domain] = await tx
      .select({ id: universityEmailDomains.id })
      .from(universityEmailDomains)
      .where(
        and(
          eq(universityEmailDomains.universityId, universityId),
          eq(universityEmailDomains.domain, email.split("@")[1]),
          eq(universityEmailDomains.approved, true),
        ),
      )
      .limit(1);
    if (!domain)
      throw new DomainError(
        "UNIVERSITY_EMAIL_REQUIRED",
        "Use an email address from an approved domain for your university.",
        400,
      );
  }
  private async invalidate(tx: Tx, userId: string) {
    await tx
      .update(verificationChallenges)
      .set({ consumedAt: new Date() })
      .where(
        and(
          eq(verificationChallenges.userId, userId),
          isNull(verificationChallenges.consumedAt),
        ),
      );
    await tx
      .update(emailOutbox)
      .set({ status: "cancelled", payloadCiphertext: null, leaseUntil: null })
      .where(
        and(
          eq(emailOutbox.userId, userId),
          like(emailOutbox.idempotencyKey, "student-verification:%"),
          inArray(emailOutbox.status, ["pending", "sending"]),
        ),
      );
  }
  async history(userId: string) {
    const rows = await this.db
      .select({
        row: studentVerifications,
        reason: verificationDecisions.reason,
        uploadId: uploads.id,
      })
      .from(studentVerifications)
      .leftJoin(
        verificationDecisions,
        eq(verificationDecisions.verificationId, studentVerifications.id),
      )
      .leftJoin(uploads, eq(uploads.verificationId, studentVerifications.id))
      .where(eq(studentVerifications.userId, userId))
      .orderBy(desc(studentVerifications.createdAt));
    return rows.map((r) => this.view(r.row, r.reason, r.uploadId));
  }
  async submit(userId: string, input: StudentVerificationInput) {
    if (input.method === "university_email")
      throw new DomainError(
        "EMAIL_CHALLENGE_REQUIRED",
        "Use the email-challenges endpoints to verify a university email.",
        400,
      );
    if (
      !input.evidenceObjectKey ||
      (input.method === "student_id" && !input.studentNumber?.trim())
    )
      throw new DomainError(
        "VERIFICATION_EVIDENCE_REQUIRED",
        "Provide a ready evidenceObjectKey; student_id also requires studentNumber.",
        400,
      );
    return this.db.transaction(async (tx) => {
      const user = await this.context(tx, userId);
      if (user.studentVerificationStatus === "verified")
        throw new DomainError(
          "ALREADY_VERIFIED",
          "Student account is already verified.",
          409,
        );
      const pending = await this.pending(tx, userId);
      if (pending && pending.method !== "university_email")
        throw new DomainError(
          "VERIFICATION_PENDING",
          "A document submission is already awaiting review.",
          409,
        );
      const recent = await tx
        .select({ id: studentVerifications.id })
        .from(studentVerifications)
        .where(
          and(
            eq(studentVerifications.userId, userId),
            gt(studentVerifications.createdAt, new Date(Date.now() - 86400000)),
          ),
        )
        .limit(3);
      if (recent.length >= 3)
        throw new DomainError(
          "VERIFICATION_RATE_LIMIT",
          "Try again after the daily submission limit resets.",
          429,
        );
      const [evidence] = await tx
        .select()
        .from(uploads)
        .where(
          and(
            eq(uploads.objectKey, input.evidenceObjectKey!),
            eq(uploads.userId, userId),
            eq(uploads.purpose, "student_evidence"),
            eq(uploads.status, "ready"),
            isNull(uploads.verificationId),
            gt(uploads.retainUntil, new Date()),
          ),
        )
        .limit(1)
        .for("update");
      if (!evidence)
        throw new DomainError(
          "EVIDENCE_NOT_READY",
          "Use your own scanned, ready, unused student evidence upload.",
          409,
        );
      await this.invalidate(tx, userId);
      if (pending)
        await tx
          .update(studentVerifications)
          .set({ status: "requires_more_information", decidedAt: new Date() })
          .where(eq(studentVerifications.id, pending.id));
      const [row] = await tx
        .insert(studentVerifications)
        .values({
          userId,
          universityId: user.universityId,
          campusId: user.campusId,
          method: input.method,
          evidenceObjectKey: evidence.objectKey,
          studentNumberHash: input.studentNumber
            ? this.hash(
                `number:${user.universityId}:${input.studentNumber.trim().toLowerCase()}`,
              )
            : null,
        })
        .returning();
      await tx
        .update(uploads)
        .set({
          verificationId: row.id,
          retainUntil: new Date(
            Date.now() +
              86400000 * this.config.get<number>("EVIDENCE_RETENTION_DAYS", 30),
          ),
        })
        .where(eq(uploads.id, evidence.id));
      await tx
        .update(users)
        .set({ studentVerificationStatus: "pending", updatedAt: new Date() })
        .where(eq(users.id, userId));
      await tx
        .insert(auditEvents)
        .values({
          actorId: userId,
          action: "student_verification.submitted",
          resourceType: "student_verification",
          resourceId: row.id,
          details: { method: input.method },
        });
      return this.view(row, null, evidence.id);
    });
  }
  async challenge(userId: string, input: EmailChallengeInput) {
    this.email.requireConfigured();
    const email = input.email.trim().toLowerCase();
    return this.db.transaction(async (tx) => {
      const user = await this.context(tx, userId);
      if (user.studentVerificationStatus === "verified")
        throw new DomainError(
          "ALREADY_VERIFIED",
          "Student account is already verified.",
          409,
        );
      await this.approvedDomain(tx, user.universityId, email);
      const pending = await this.pending(tx, userId);
      if (pending && pending.method !== "university_email")
        throw new DomainError(
          "VERIFICATION_PENDING",
          "Your document submission is awaiting review.",
          409,
        );
      const recent = await tx
        .select({ createdAt: verificationChallenges.createdAt })
        .from(verificationChallenges)
        .where(
          and(
            eq(verificationChallenges.userId, userId),
            gt(
              verificationChallenges.createdAt,
              new Date(Date.now() - 3600000),
            ),
          ),
        )
        .orderBy(desc(verificationChallenges.createdAt))
        .limit(3);
      if (
        recent.length >= 3 ||
        (recent[0] && recent[0].createdAt.getTime() > Date.now() - 60000)
      )
        throw new DomainError(
          "VERIFICATION_RATE_LIMIT",
          "Wait before requesting another code (60 seconds between sends; 3 per hour).",
          429,
        );
      const [claimed] = await tx
        .select({ id: studentVerifications.id })
        .from(studentVerifications)
        .where(
          and(
            eq(studentVerifications.verifiedEmail, email),
            eq(studentVerifications.status, "verified"),
          ),
        )
        .limit(1);
      if (claimed)
        throw new DomainError(
          "UNIVERSITY_EMAIL_IN_USE",
          "This university email has already verified an account.",
          409,
        );
      await this.invalidate(tx, userId);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 600000);
      const id = randomUUID();
      const code = String(randomInt(0, 1000000)).padStart(6, "0");
      let row = pending;
      if (row)
        [row] = await tx
          .update(studentVerifications)
          .set({
            universityId: user.universityId,
            campusId: user.campusId,
            verifiedEmail: email,
          })
          .where(eq(studentVerifications.id, row.id))
          .returning();
      else
        [row] = await tx
          .insert(studentVerifications)
          .values({
            userId,
            method: "university_email",
            universityId: user.universityId,
            campusId: user.campusId,
            verifiedEmail: email,
          })
          .returning();
      await tx
        .insert(verificationChallenges)
        .values({
          id,
          verificationId: row.id,
          userId,
          universityId: user.universityId,
          campusId: user.campusId,
          email,
          codeHash: this.hash(`code:${id}:${code}`),
          expiresAt,
          createdAt: now,
        });
      await tx
        .insert(emailOutbox)
        .values({
          userId,
          idempotencyKey: `student-verification:${id}`,
          payloadCiphertext: this.email.encrypt({
            to: email,
            subject: "Verify your Konet student account",
            text: `Your Konet verification code is ${code}. It expires in 10 minutes. Do not share it. If you did not request this, ignore this email.`,
          }),
          expiresAt,
        });
      await tx
        .update(users)
        .set({ studentVerificationStatus: "pending", updatedAt: now })
        .where(eq(users.id, userId));
      await tx
        .insert(auditEvents)
        .values({
          actorId: userId,
          action: "student_verification.email_requested",
          resourceType: "student_verification",
          resourceId: row.id,
          details: {},
        });
      return {
        challengeId: id,
        expiresAt,
        delivery: "email",
        resendAfter: new Date(now.getTime() + 60000),
      };
    });
  }
  async confirm(userId: string, input: ConfirmChallengeInput) {
    try {
      const result = await this.db.transaction(async (tx) => {
        const user = await this.context(tx, userId);
        const [challenge] = await tx
          .select()
          .from(verificationChallenges)
          .where(
            and(
              eq(verificationChallenges.id, input.challengeId),
              eq(verificationChallenges.userId, userId),
            ),
          )
          .limit(1)
          .for("update");
        if (
          !challenge ||
          challenge.consumedAt ||
          challenge.expiresAt <= new Date() ||
          challenge.attempts >= 5
        )
          return new DomainError(
            "VERIFICATION_CODE_INVALID",
            "Code is expired, used, or unavailable. Request a new one.",
            400,
          );
        if (
          !/^\d{6}$/.test(input.code) ||
          !timingSafeEqual(
            Buffer.from(challenge.codeHash, "hex"),
            Buffer.from(this.hash(`code:${challenge.id}:${input.code}`), "hex"),
          )
        ) {
          await tx
            .update(verificationChallenges)
            .set({
              attempts: challenge.attempts + 1,
              consumedAt: challenge.attempts >= 4 ? new Date() : null,
            })
            .where(eq(verificationChallenges.id, challenge.id));
          return new DomainError(
            "VERIFICATION_CODE_INVALID",
            "Invalid verification code.",
            400,
          );
        }
        if (
          user.universityId !== challenge.universityId ||
          user.campusId !== challenge.campusId
        )
          throw new DomainError(
            "VERIFICATION_CONTEXT_CHANGED",
            "University or campus changed. Request a new code.",
            409,
          );
        await this.approvedDomain(tx, user.universityId, challenge.email);
        const row = await this.pending(tx, userId);
        if (
          !row ||
          row.id !== challenge.verificationId ||
          row.method !== "university_email" ||
          row.verifiedEmail !== challenge.email ||
          user.studentVerificationStatus === "verified"
        )
          return new DomainError(
            "VERIFICATION_CODE_INVALID",
            "Verification is no longer pending.",
            400,
          );
        const [updated] = await tx
          .update(studentVerifications)
          .set({ status: "verified", decidedAt: new Date() })
          .where(eq(studentVerifications.id, row.id))
          .returning();
        await this.invalidate(tx, userId);
        await tx
          .update(users)
          .set({ studentVerificationStatus: "verified", updatedAt: new Date() })
          .where(eq(users.id, userId));
        await this.recordDecision(
          tx,
          updated,
          null,
          "verified",
          "University email ownership confirmed.",
          "university_email",
        );
        return this.view(updated, "University email ownership confirmed.");
      });
      if (result instanceof DomainError) throw result;
      return result;
    } catch (error) {
      if (
        (error as { cause?: { code?: string }; code?: string }).cause?.code ===
          "23505" ||
        (error as { code?: string }).code === "23505"
      )
        throw new DomainError(
          "UNIVERSITY_EMAIL_IN_USE",
          "This university email has already verified an account.",
          409,
        );
      throw error;
    }
  }
  private async recordDecision(
    tx: Tx,
    row: Verification,
    actorId: string | null,
    decision: string,
    reason: string,
    source: string,
  ) {
    const [result] = await tx
      .insert(verificationDecisions)
      .values({ verificationId: row.id, actorId, decision, reason, source })
      .returning();
    await tx
      .insert(auditEvents)
      .values({
        actorId,
        action: "student_verification.decided",
        resourceType: "student_verification",
        resourceId: row.id,
        reason,
        details: { decision, source },
      });
    await tx
      .insert(notifications)
      .values({
        userId: row.userId,
        type: "student_verification",
        title: "Student verification updated",
        body: reason,
        resourceType: "student_verification",
        resourceId: row.id,
      });
    return {
      id: result.id,
      resourceType: "student_verification",
      resourceId: row.id,
      actorId,
      decision,
      reason,
      source,
      createdAt: result.createdAt,
    };
  }
  async queue(query: VerificationQuery) {
    const rows = await this.db
      .select({
        row: studentVerifications,
        reason: verificationDecisions.reason,
        uploadId: uploads.id,
      })
      .from(studentVerifications)
      .leftJoin(
        verificationDecisions,
        eq(verificationDecisions.verificationId, studentVerifications.id),
      )
      .leftJoin(uploads, eq(uploads.verificationId, studentVerifications.id))
      .where(
        and(
          ne(studentVerifications.method, "university_email"),
          eq(studentVerifications.status, query.status ?? "pending"),
        ),
      )
      .orderBy(desc(studentVerifications.createdAt))
      .limit(query.limit ?? 20)
      .offset(query.offset ?? 0);
    return rows.map((r) => this.view(r.row, r.reason, r.uploadId));
  }
  async detail(id: string) {
    const [result] = await this.db
      .select({
        row: studentVerifications,
        reason: verificationDecisions.reason,
        uploadId: uploads.id,
      })
      .from(studentVerifications)
      .leftJoin(
        verificationDecisions,
        eq(verificationDecisions.verificationId, studentVerifications.id),
      )
      .leftJoin(uploads, eq(uploads.verificationId, studentVerifications.id))
      .where(eq(studentVerifications.id, id))
      .limit(1);
    if (!result)
      throw new DomainError(
        "VERIFICATION_NOT_FOUND",
        "Verification not found.",
        404,
      );
    return this.view(result.row, result.reason, result.uploadId);
  }
  async decide(actorId: string, id: string, input: DecisionInput) {
    const [initial] = await this.db
      .select({ userId: studentVerifications.userId })
      .from(studentVerifications)
      .where(eq(studentVerifications.id, id))
      .limit(1);
    if (!initial)
      throw new DomainError(
        "VERIFICATION_NOT_FOUND",
        "Verification not found.",
        404,
      );
    if (initial.userId === actorId)
      throw new DomainError(
        "SELF_REVIEW_FORBIDDEN",
        "Another reviewer must decide your submission.",
        403,
      );
    return this.db.transaction(async (tx) => {
      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.id, initial.userId))
        .limit(1)
        .for("update");
      const [row] = await tx
        .select()
        .from(studentVerifications)
        .where(eq(studentVerifications.id, id))
        .limit(1)
        .for("update");
      if (!row || row.status !== "pending")
        throw new DomainError(
          "VERIFICATION_ALREADY_DECIDED",
          "This submission is no longer pending.",
          409,
        );
      if (row.method === "university_email")
        throw new DomainError(
          "AUTOMATIC_VERIFICATION_ONLY",
          "University email is verified by its code, without a manual decision.",
          409,
        );
      if (!input.reason.trim())
        throw new DomainError(
          "DECISION_REASON_REQUIRED",
          "Explain the decision.",
          400,
        );
      if (input.decision === "verified") {
        const current = await this.context(tx, row.userId);
        if (
          current.universityId !== row.universityId ||
          current.campusId !== row.campusId ||
          current.studentVerificationStatus === "verified"
        )
          throw new DomainError(
            "VERIFICATION_CONTEXT_CHANGED",
            "The student must resubmit for their current university and campus.",
            409,
          );
        const [evidence] = await tx
          .select()
          .from(uploads)
          .where(
            and(
              eq(uploads.verificationId, row.id),
              eq(uploads.userId, row.userId),
              eq(uploads.status, "ready"),
              gt(uploads.retainUntil, new Date()),
            ),
          )
          .limit(1)
          .for("update");
        if (!evidence)
          throw new DomainError(
            "EVIDENCE_NOT_READY",
            "Approval requires available scanned evidence.",
            409,
          );
      }
      if (!user)
        throw new DomainError(
          "ACCOUNT_UNAVAILABLE",
          "Account is unavailable.",
          409,
        );
      const decision = input.decision as
        "verified" | "rejected" | "requires_more_information";
      const [updated] = await tx
        .update(studentVerifications)
        .set({ status: decision, decidedAt: new Date() })
        .where(eq(studentVerifications.id, id))
        .returning();
      await tx
        .update(users)
        .set({ studentVerificationStatus: decision, updatedAt: new Date() })
        .where(eq(users.id, row.userId));
      await tx
        .update(uploads)
        .set({
          retainUntil: new Date(
            Date.now() +
              86400000 * this.config.get<number>("EVIDENCE_RETENTION_DAYS", 30),
          ),
        })
        .where(eq(uploads.verificationId, id));
      return this.recordDecision(
        tx,
        updated,
        actorId,
        decision,
        input.reason.trim(),
        "staff_review",
      );
    });
  }
}
