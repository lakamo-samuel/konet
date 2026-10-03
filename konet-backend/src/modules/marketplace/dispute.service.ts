import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { DATABASE, Database } from "../../database/database.module";
import * as s from "../../database/schema";
import { DomainError } from "../../common/errors/domain.error";
import { DisputeDto } from "./dto";
import { DisputeDecisionInput, ListQuery } from "../contracts/contract.dto";
import { queueClientPayout } from "./settlement.service";
import { LiveEvent, RealtimePublisher } from "../realtime/realtime.publisher";
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
@Injectable()
export class DisputeService {
  constructor(
    @Inject(DATABASE) private db: Database,
    private realtime: RealtimePublisher,
  ) {}
  private fail(code: string, message: string, status = 409): never {
    throw new DomainError(code, message, status);
  }
  private async participants(
    tx: Database | Tx,
    job: typeof s.jobs.$inferSelect,
  ) {
    const [p] = await tx
      .select()
      .from(s.providerProfiles)
      .where(eq(s.providerProfiles.id, job.providerId));
    return [job.clientId, p.userId];
  }
  private async notify(
    tx: Tx,
    events: LiveEvent[],
    job: typeof s.jobs.$inferSelect,
    disputeId: string,
    body: string,
  ) {
    for (const userId of await this.participants(tx, job)) {
      const [notification] = await tx
        .insert(s.notifications)
        .values({
          userId,
          type: "dispute",
          title: "Dispute update",
          body,
          resourceType: "dispute",
          resourceId: disputeId,
        })
        .returning();
      events.push({ event: "notification.new", userId, payload: notification });
    }
  }
  private async commit<T>(fn: (tx: Tx, events: LiveEvent[]) => Promise<T>) {
    const events: LiveEvent[] = [];
    const result = await this.db.transaction((tx) => fn(tx, events));
    await this.realtime.publish(events);
    return result;
  }
  async open(userId: string, jobId: string, input: DisputeDto) {
    return this.commit(async (tx, events) => {
      const [job] = await tx
        .select()
        .from(s.jobs)
        .where(eq(s.jobs.id, jobId))
        .for("update");
      if (!job || !(await this.participants(tx, job)).includes(userId))
        this.fail("JOB_NOT_FOUND", "Job not found.", 404);
      const [existing] = await tx
        .select()
        .from(s.disputes)
        .where(
          and(
            eq(s.disputes.jobId, jobId),
            inArray(s.disputes.status, ["open", "under_review"]),
          ),
        );
      if (existing) {
        if (
          existing.openedByUserId === userId &&
          existing.reason === input.reason &&
          existing.description === input.description
        )
          return existing;
        this.fail("DISPUTE_EXISTS", "This job already has an open dispute.");
      }
      if (
        !["scheduled", "in_progress", "awaiting_client_confirmation"].includes(
          job.status,
        )
      )
        this.fail(
          "DISPUTE_NOT_ALLOWED",
          "This job cannot be disputed in its current state.",
        );
      const [payment] = await tx
        .select()
        .from(s.payments)
        .where(eq(s.payments.jobId, jobId))
        .for("update");
      if (!payment || !["funded", "held"].includes(payment.status))
        this.fail("DISPUTE_NOT_ALLOWED", "Only funded work can be disputed.");
      const [out] = await tx
        .insert(s.disputes)
        .values({ jobId, openedByUserId: userId, ...input })
        .returning();
      await tx
        .update(s.jobs)
        .set({ status: "disputed", updatedAt: new Date() })
        .where(eq(s.jobs.id, jobId));
      await tx
        .update(s.payments)
        .set({ status: "disputed", updatedAt: new Date() })
        .where(eq(s.payments.id, payment.id));
      await tx.insert(s.auditEvents).values({
        actorId: userId,
        action: "dispute.opened",
        resourceType: "dispute",
        resourceId: out.id,
        reason: input.reason,
        details: { jobId },
      });
      await this.notify(
        tx,
        events,
        job,
        out.id,
        "Payment release is paused pending a staff decision.",
      );
      return out;
    });
  }
  private status(q: ListQuery) {
    if (
      q.status &&
      ![
        "open",
        "under_review",
        "resolved_for_client",
        "resolved_for_provider",
        "closed",
      ].includes(q.status)
    )
      this.fail("INVALID_STATUS", "Invalid dispute status.", 400);
    return q.status as typeof s.disputes.$inferSelect.status | undefined;
  }
  async list(userId: string | undefined, q: ListQuery) {
    const status = this.status(q);
    return this.db
      .select({ dispute: s.disputes })
      .from(s.disputes)
      .innerJoin(s.jobs, eq(s.jobs.id, s.disputes.jobId))
      .innerJoin(
        s.providerProfiles,
        eq(s.providerProfiles.id, s.jobs.providerId),
      )
      .where(
        and(
          userId
            ? or(
                eq(s.jobs.clientId, userId),
                eq(s.providerProfiles.userId, userId),
              )
            : undefined,
          status ? eq(s.disputes.status, status) : undefined,
        ),
      )
      .orderBy(desc(s.disputes.createdAt), s.disputes.id)
      .limit(q.limit ?? 20)
      .offset(q.offset ?? 0)
      .then((rows) => rows.map((r) => r.dispute));
  }
  async detail(userId: string | undefined, id: string) {
    const [row] = await this.db
      .select({ dispute: s.disputes, job: s.jobs })
      .from(s.disputes)
      .innerJoin(s.jobs, eq(s.jobs.id, s.disputes.jobId))
      .where(eq(s.disputes.id, id));
    if (
      !row ||
      (userId && !(await this.participants(this.db, row.job)).includes(userId))
    )
      this.fail("DISPUTE_NOT_FOUND", "Dispute not found.", 404);
    return row.dispute;
  }
  async staffDetail(actorId:string,id:string) {
    const dispute=await this.detail(undefined,id);
    return this.db.transaction(async tx=>{
      const [job]=await tx.select().from(s.jobs).where(eq(s.jobs.id,dispute.jobId));
      const [payment]=await tx.select().from(s.payments).where(eq(s.payments.jobId,job.id));
      const decisions=await tx.select().from(s.disputeDecisions).where(eq(s.disputeDecisions.disputeId,id)).orderBy(s.disputeDecisions.createdAt);
      const milestones=await tx.select().from(s.jobMilestones).where(eq(s.jobMilestones.jobId,job.id)).orderBy(s.jobMilestones.createdAt);
      const [conversation]=await tx.select().from(s.conversations).where(or(eq(s.conversations.jobId,job.id),eq(s.conversations.requestId,job.requestId))).limit(1);
      const messages=conversation?await tx.select({id:s.messages.id,sender:s.users.fullName,type:s.messages.type,content:s.messages.content,createdAt:s.messages.createdAt}).from(s.messages).innerJoin(s.users,eq(s.users.id,s.messages.senderId)).where(and(eq(s.messages.conversationId,conversation.id),isNull(s.messages.deletedAt))).orderBy(desc(s.messages.createdAt),desc(s.messages.id)).limit(100):[];
      await tx.insert(s.auditEvents).values({actorId,action:'dispute.review_accessed',resourceType:'dispute',resourceId:id,details:{messageCount:messages.length}});
      return {...dispute,job,payment,decisions,milestones,messages:messages.reverse(),messageLimit:100};
    },{isolationLevel:'repeatable read'});
  }
  async decisions(userId: string, id: string) {
    await this.detail(userId, id);
    return this.db
      .select()
      .from(s.disputeDecisions)
      .where(eq(s.disputeDecisions.disputeId, id))
      .orderBy(s.disputeDecisions.createdAt, s.disputeDecisions.id);
  }
  async decide(actorId: string, id: string, input: DisputeDecisionInput) {
    if (input.reason.trim().length < 3 || input.reason.length > 2000)
      this.fail(
        "INVALID_REASON",
        "Provide a reason of 3–2000 characters.",
        422,
      );
    return this.commit(async (tx, events) => {
      const [initial] = await tx
        .select()
        .from(s.disputes)
        .where(eq(s.disputes.id, id));
      if (!initial) this.fail("DISPUTE_NOT_FOUND", "Dispute not found.", 404);
      const [job] = await tx
        .select()
        .from(s.jobs)
        .where(eq(s.jobs.id, initial.jobId))
        .for("update");
      const [payment] = await tx
        .select()
        .from(s.payments)
        .where(eq(s.payments.jobId, job.id))
        .for("update");
      const [dispute] = await tx
        .select()
        .from(s.disputes)
        .where(eq(s.disputes.id, id))
        .for("update");
      if ((await this.participants(tx, job)).includes(actorId))
        this.fail(
          "SELF_DECISION_FORBIDDEN",
          "Another authorized staff member must resolve this dispute.",
          403,
        );
      const refundAmount =
        input.decision === "resolved_for_client" ? payment?.amountMinor : null;
      if (
        (input.decision === "resolved_for_client" &&
          input.refundAmountMinor !== undefined &&
          input.refundAmountMinor !== refundAmount) ||
        (input.decision === "resolved_for_provider" &&
          input.refundAmountMinor !== undefined &&
          input.refundAmountMinor !== 0)
      )
        this.fail(
          "INVALID_REFUND_AMOUNT",
          "Client decisions refund the full payment; provider decisions cannot include a refund.",
          422,
        );
      const [existing] = await tx
        .select()
        .from(s.disputeDecisions)
        .where(eq(s.disputeDecisions.disputeId, id));
      if (existing) {
        if (
          existing.actorId === actorId &&
          existing.decision === input.decision &&
          existing.reason === input.reason.trim() &&
          existing.refundAmountMinor === refundAmount
        )
          return existing;
        this.fail(
          "DISPUTE_ALREADY_RESOLVED",
          "This dispute already has a final decision.",
        );
      }
      if (
        !["open", "under_review"].includes(dispute.status) ||
        job.status !== "disputed" ||
        !payment ||
        payment.status !== "disputed"
      )
        this.fail(
          "DISPUTE_NOT_RESOLVABLE",
          "This dispute is not awaiting resolution.",
        );
      const [proof] = await tx
        .select()
        .from(s.paymentEvents)
        .where(
          and(
            eq(s.paymentEvents.paymentId, payment.id),
            eq(s.paymentEvents.type, "charge.success"),
          ),
        );
      const [payout] = await tx
        .select()
        .from(s.payouts)
        .where(eq(s.payouts.paymentId, payment.id));
      const [refund] = await tx
        .select()
        .from(s.refunds)
        .where(eq(s.refunds.paymentId, payment.id));
      if (
        !proof ||
        payment.gateway !== "paystack" ||
        !payment.gatewayReference ||
        payment.currency !== "NGN" ||
        payment.amountMinor <= 0 ||
        payout ||
        refund
      )
        this.fail(
          "FINANCIAL_REVIEW_REQUIRED",
          "Verified collection without a prior payout or refund is required.",
        );
      await tx
        .update(s.disputes)
        .set({
          status: input.decision as
            "resolved_for_client" | "resolved_for_provider",
          resolvedAt: new Date(),
        })
        .where(eq(s.disputes.id, id));
      await tx
        .update(s.payments)
        .set({ status: "funded", updatedAt: new Date() })
        .where(eq(s.payments.id, payment.id));
      if (input.decision === "resolved_for_provider") {
        await tx
          .update(s.jobs)
          .set({
            status: "completed",
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(s.jobs.id, job.id));
        await queueClientPayout(tx, job, payment);
      } else {
        await tx
          .update(s.jobs)
          .set({ status: "cancelled", updatedAt: new Date() })
          .where(eq(s.jobs.id, job.id));
        await tx.insert(s.refunds).values({
          paymentId: payment.id,
          amountMinor: payment.amountMinor,
          currency: payment.currency,
          reason: input.reason.trim(),
          actorId,
        });
      }
      const [out] = await tx
        .insert(s.disputeDecisions)
        .values({
          disputeId: id,
          actorId,
          decision: input.decision,
          reason: input.reason.trim(),
          refundAmountMinor: refundAmount,
        })
        .returning();
      await tx.insert(s.auditEvents).values({
        actorId,
        action: "dispute.resolved",
        resourceType: "dispute",
        resourceId: id,
        reason: out.reason,
        details: {
          decisionId: out.id,
          decision: out.decision,
          jobId: job.id,
          paymentId: payment.id,
          refundAmountMinor: refundAmount,
        },
      });
      await this.notify(
        tx,
        events,
        job,
        id,
        input.decision === "resolved_for_client"
          ? "Resolved for client. A full refund is queued; returned funds require Paystack confirmation."
          : "Resolved for provider. Payout is queued; paid funds require Paystack confirmation.",
      );
      return out;
    });
  }
}
