import { RealtimePublisher, LiveEvent } from "../realtime/realtime.publisher";
import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, isNull, sql, or } from "drizzle-orm";
import { DATABASE, Database } from "../../database/database.module";
import * as s from "../../database/schema";
import { DomainError } from "../../common/errors/domain.error";
import {
  ListQuery,
  MilestoneInput,
  MilestoneUpdateInput,
  PreferencesInput,
} from "../contracts/contract.dto";
import { assertJobTransition, JobState } from "./job-state-machine";
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
@Injectable()
export class CollaborationService {
  constructor(
    @Inject(DATABASE) private db: Database,
    private realtime: RealtimePublisher,
  ) {}
  private async commit<T>(
    action: (tx: Tx, events: LiveEvent[]) => Promise<T>,
  ): Promise<T> {
    const events: LiveEvent[] = [];
    const result = await this.db.transaction((tx) => action(tx, events));
    await this.realtime.publish(events);
    return result;
  }
  private fail(code: string, message: string, status = 409): never {
    throw new DomainError(code, message, status);
  }
  private async job(
    tx: Database | Tx,
    userId: string,
    id: string,
    lock = false,
  ) {
    const query = tx.select().from(s.jobs).where(eq(s.jobs.id, id));
    const [job] = await (lock ? query.for("update") : query);
    const [provider] = job
      ? await tx
          .select()
          .from(s.providerProfiles)
          .where(eq(s.providerProfiles.id, job.providerId))
      : [];
    if (!job || (job.clientId !== userId && provider?.userId !== userId))
      this.fail("JOB_NOT_FOUND", "Job not found.", 404);
    return {
      job,
      providerUserId: provider!.userId,
      isProvider: provider!.userId === userId,
    };
  }
  async jobs(userId: string, q: ListQuery) {
    const statuses = [
      "awaiting_payment",
      "scheduled",
      "in_progress",
      "awaiting_client_confirmation",
      "completed",
      "cancelled",
      "disputed",
    ];
    if (q.status && !statuses.includes(q.status))
      this.fail("INVALID_STATUS", "Invalid job status.", 400);
    const [provider] = await this.db
      .select()
      .from(s.providerProfiles)
      .where(eq(s.providerProfiles.userId, userId));
    return this.db
      .select()
      .from(s.jobs)
      .where(
        and(
          provider
            ? or(
                eq(s.jobs.clientId, userId),
                eq(s.jobs.providerId, provider.id),
              )
            : eq(s.jobs.clientId, userId),
          q.status ? eq(s.jobs.status, q.status as JobState) : undefined,
        ),
      )
      .orderBy(desc(s.jobs.createdAt), s.jobs.id)
      .limit(q.limit ?? 20)
      .offset(q.offset ?? 0);
  }
  async jobDetail(userId: string, id: string) {
    return (await this.job(this.db, userId, id)).job;
  }
  private async notify(
    tx: Tx,
    userId: string,
    type: string,
    title: string,
    resourceType: string,
    resourceId: string,
    events: LiveEvent[],
  ) {
    const [pref] = await tx
      .select()
      .from(s.notificationPreferences)
      .where(eq(s.notificationPreferences.userId, userId));
    if (pref?.inAppEnabled === false) return;
    const [notification] = await tx
      .insert(s.notifications)
      .values({ userId, type, title, body: title, resourceType, resourceId })
      .returning();
    events.push({ userId, event: "notification.new", payload: notification });
  }
  async transition(userId: string, id: string, to: JobState, reason?: string) {
    return this.commit(async (tx, events) => {
      const { job, providerUserId, isProvider } = await this.job(
        tx,
        userId,
        id,
        true,
      );
      if (
        to !== "cancelled" &&
        ((to === "completed" && isProvider) ||
          (to !== "completed" && !isProvider))
      )
        this.fail(
          "JOB_ACTION_FORBIDDEN",
          "Only the assigned participant can perform this action.",
          403,
        );
      if (job.status === to) return job;
      if (to === "cancelled") {
        if (!reason || reason.trim().length < 3)
          this.fail(
            "INVALID_REASON",
            "A cancellation reason is required.",
            422,
          );
        if (job.status !== "awaiting_payment")
          this.fail(
            "CANCELLATION_REQUIRES_REFUND",
            "Only unpaid jobs can be cancelled until the refund workflow is configured.",
          );
        const [payment] = await tx
          .select()
          .from(s.payments)
          .where(eq(s.payments.jobId, id))
          .for("update");
        if (payment && !["pending", "failed"].includes(payment.status))
          this.fail(
            "CANCELLATION_REQUIRES_REFUND",
            "Payment activity prevents cancellation.",
          );
      }
      assertJobTransition(job.status as JobState, to);
      if (to === "in_progress" || to === "completed") {
        const [payment] = await tx
          .select()
          .from(s.payments)
          .where(eq(s.payments.jobId, id))
          .for("update");
        if (!payment || !["funded", "held"].includes(payment.status))
          this.fail("JOB_PAYMENT_NOT_FUNDED", "Verified funding is required.");
      }
      if (to === "awaiting_client_confirmation") {
        const [pending] = await tx
          .select()
          .from(s.jobMilestones)
          .where(
            and(
              eq(s.jobMilestones.jobId, id),
              sql`${s.jobMilestones.status} <> 'completed'`,
            ),
          )
          .limit(1);
        if (pending)
          this.fail(
            "MILESTONES_INCOMPLETE",
            "Complete all milestones before submitting the job.",
          );
      }
      const now = new Date();
      const [out] = await tx
        .update(s.jobs)
        .set({
          status: to,
          updatedAt: now,
          ...(to === "in_progress" ? { startedAt: now } : {}),
          ...(to === "awaiting_client_confirmation"
            ? { providerCompletedAt: now }
            : {}),
          ...(to === "completed"
            ? { clientConfirmedAt: now, completedAt: now }
            : {}),
        })
        .where(eq(s.jobs.id, id))
        .returning();
      await tx.insert(s.auditEvents).values({
        actorId: userId,
        action: `job.${to}`,
        resourceType: "job",
        resourceId: id,
        details: { from: job.status, reason },
      });
      await this.notify(
        tx,
        isProvider ? job.clientId : providerUserId,
        "job_updated",
        `Job ${to.replaceAll("_", " ")}`,
        "job",
        id,
        events,
      );
      return out;
    });
  }
  async milestones(userId: string, id: string) {
    await this.job(this.db, userId, id);
    return this.db
      .select()
      .from(s.jobMilestones)
      .where(eq(s.jobMilestones.jobId, id))
      .orderBy(s.jobMilestones.createdAt, s.jobMilestones.id);
  }
  async saveMilestone(
    userId: string,
    id: string,
    input: MilestoneInput | MilestoneUpdateInput,
    milestoneId?: string,
  ) {
    return this.commit(async (tx, events) => {
      const { job, isProvider } = await this.job(tx, userId, id, true);
      if (!isProvider)
        this.fail(
          "PROVIDER_REQUIRED",
          "Only the provider manages milestones.",
          403,
        );
      if (
        !["awaiting_payment", "scheduled", "in_progress"].includes(job.status)
      )
        this.fail("JOB_CLOSED", "Milestones cannot change in this job state.");
      const fields = Object.fromEntries(
        Object.entries(input).filter(([, v]) => v !== undefined),
      );
      if (!Object.keys(fields).length)
        this.fail("EMPTY_UPDATE", "Provide milestone fields.", 400);
      if (Object.values(fields).some((v) => v === null))
        this.fail("INVALID_MILESTONE", "Null fields are not supported.", 400);
      if (
        input.title !== undefined &&
        (input.title.trim().length < 3 || input.title.length > 160)
      )
        this.fail("INVALID_TITLE", "Title must contain 3–160 characters.", 422);
      if (input.description && input.description.length > 10000)
        this.fail("INVALID_DESCRIPTION", "Description is too long.", 422);
      if (input.dueAt && new Date(input.dueAt) <= new Date())
        this.fail("INVALID_DUE_DATE", "Due date must be in the future.", 422);
      const status = (input as MilestoneUpdateInput).status;
      if (status && status !== "pending" && job.status !== "in_progress")
        this.fail(
          "JOB_NOT_STARTED",
          "Start the job before progressing milestones.",
        );
      let out;
      const patch = {
        ...fields,
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.dueAt ? { dueAt: new Date(input.dueAt) } : {}),
      };
      if (milestoneId) {
        const [old] = await tx
          .select()
          .from(s.jobMilestones)
          .where(
            and(
              eq(s.jobMilestones.id, milestoneId),
              eq(s.jobMilestones.jobId, id),
            ),
          );
        if (!old) this.fail("MILESTONE_NOT_FOUND", "Milestone not found.", 404);
        const rank = { pending: 0, in_progress: 1, completed: 2 };
        if (
          status &&
          rank[status as keyof typeof rank] <
            rank[old.status as keyof typeof rank]
        )
          this.fail(
            "INVALID_MILESTONE_TRANSITION",
            "Milestone progress cannot move backwards.",
          );
        [out] = await tx
          .update(s.jobMilestones)
          .set({
            ...patch,
            updatedAt: new Date(),
            ...(status === "completed"
              ? { completedAt: old.completedAt ?? new Date() }
              : {}),
          })
          .where(eq(s.jobMilestones.id, milestoneId))
          .returning();
      } else {
        const [{ count }] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(s.jobMilestones)
          .where(eq(s.jobMilestones.jobId, id));
        if (count >= 50)
          this.fail("MILESTONE_LIMIT", "A job supports up to 50 milestones.");
        [out] = await tx
          .insert(s.jobMilestones)
          .values({ ...patch, jobId: id, title: input.title!.trim() })
          .returning();
      }
      await tx.insert(s.auditEvents).values({
        actorId: userId,
        action: milestoneId ? "milestone.updated" : "milestone.created",
        resourceType: "milestone",
        resourceId: out.id,
        details: { jobId: id },
      });
      await this.notify(
        tx,
        job.clientId,
        "milestone_updated",
        "Job milestone updated",
        "job",
        id,
        events,
      );
      return out;
    });
  }
  private async participant(tx: Database | Tx, userId: string, id: string) {
    const [p] = await tx
      .select()
      .from(s.conversationParticipants)
      .where(
        and(
          eq(s.conversationParticipants.userId, userId),
          eq(s.conversationParticipants.conversationId, id),
        ),
      );
    if (!p) this.fail("CONVERSATION_NOT_FOUND", "Conversation not found.", 404);
  }
  async conversation(userId: string, id: string) {
    await this.participant(this.db, userId, id);
    const [c] = await this.db
      .select()
      .from(s.conversations)
      .where(eq(s.conversations.id, id));
    const members = await this.db
      .select()
      .from(s.conversationParticipants)
      .where(eq(s.conversationParticipants.conversationId, id));
    return { ...c, participantIds: members.map((p) => p.userId) };
  }
  async conversations(userId: string, q: ListQuery) {
    if (q.status)
      this.fail(
        "INVALID_STATUS",
        "Conversations do not support status filters.",
        400,
      );
    const rows = await this.db
      .select({ id: s.conversations.id })
      .from(s.conversations)
      .innerJoin(
        s.conversationParticipants,
        and(
          eq(s.conversationParticipants.conversationId, s.conversations.id),
          eq(s.conversationParticipants.userId, userId),
        ),
      )
      .orderBy(desc(s.conversations.updatedAt), s.conversations.id)
      .limit(q.limit ?? 20)
      .offset(q.offset ?? 0);
    return Promise.all(rows.map((r) => this.conversation(userId, r.id)));
  }
  async jobConversation(userId: string, id: string) {
    await this.job(this.db, userId, id);
    const [c] = await this.db
      .select()
      .from(s.conversations)
      .where(eq(s.conversations.jobId, id))
      .limit(1);
    if (!c) this.fail("CONVERSATION_NOT_FOUND", "Conversation not found.", 404);
    return this.conversation(userId, c.id);
  }
  async messages(userId: string, id: string, q: ListQuery) {
    await this.participant(this.db, userId, id);
    if (q.status)
      this.fail(
        "INVALID_STATUS",
        "Messages do not support status filters.",
        400,
      );
    return this.db
      .select()
      .from(s.messages)
      .where(
        and(eq(s.messages.conversationId, id), isNull(s.messages.deletedAt)),
      )
      .orderBy(s.messages.createdAt, s.messages.id)
      .limit(q.limit ?? 20)
      .offset(q.offset ?? 0);
  }
  async send(userId: string, id: string, content: string) {
    if (!content.trim() || content.length > 10000)
      this.fail(
        "INVALID_MESSAGE",
        "Message must contain 1–10,000 characters.",
        422,
      );
    return this.commit(async (tx, events) => {
      await this.participant(tx, userId, id);
      await tx
        .select()
        .from(s.conversations)
        .where(eq(s.conversations.id, id))
        .for("update");
      const [out] = await tx
        .insert(s.messages)
        .values({
          conversationId: id,
          senderId: userId,
          content: content.trim(),
          createdAt: new Date(),
        })
        .returning();
      await tx
        .update(s.conversations)
        .set({ updatedAt: new Date() })
        .where(eq(s.conversations.id, id));
      const members = await tx
        .select()
        .from(s.conversationParticipants)
        .where(eq(s.conversationParticipants.conversationId, id));
      for (const p of members)
        events.push({
          userId: p.userId,
          event: "message.new",
          payload: out,
          conversationId: id,
        });
      for (const p of members)
        if (p.userId !== userId)
          await this.notify(
            tx,
            p.userId,
            "message_received",
            "New conversation message",
            "conversation",
            id,
            events,
          );
      return out;
    });
  }
  async readConversation(userId: string, id: string) {
    return this.commit(async (tx, events) => {
      await this.participant(tx, userId, id);
      await tx
        .select()
        .from(s.conversations)
        .where(eq(s.conversations.id, id))
        .for("update");
      const readAt = new Date();
      await tx
        .insert(s.conversationReads)
        .values({ conversationId: id, userId, readAt })
        .onConflictDoUpdate({
          target: [
            s.conversationReads.conversationId,
            s.conversationReads.userId,
          ],
          set: { readAt },
        });
      await tx
        .update(s.notifications)
        .set({ readAt })
        .where(
          and(
            eq(s.notifications.userId, userId),
            eq(s.notifications.resourceType, "conversation"),
            eq(s.notifications.resourceId, id),
            isNull(s.notifications.readAt),
          ),
        );
      const members = await tx
        .select()
        .from(s.conversationParticipants)
        .where(eq(s.conversationParticipants.conversationId, id));
      for (const p of members)
        events.push({
          userId: p.userId,
          event: "conversation.read",
          payload: { conversationId: id, userId, readAt },
          conversationId: id,
        });
      return { message: "Conversation marked read.", readAt };
    });
  }
  async notifications(userId: string, q: ListQuery) {
    if (q.status && !["read", "unread"].includes(q.status))
      this.fail("INVALID_STATUS", "Use read or unread.", 400);
    return this.db
      .select()
      .from(s.notifications)
      .where(
        and(
          eq(s.notifications.userId, userId),
          q.status === "unread"
            ? isNull(s.notifications.readAt)
            : q.status === "read"
              ? sql`${s.notifications.readAt} IS NOT NULL`
              : undefined,
        ),
      )
      .orderBy(desc(s.notifications.createdAt), s.notifications.id)
      .limit(q.limit ?? 20)
      .offset(q.offset ?? 0);
  }
  async readNotification(userId: string, id: string) {
    const [n] = await this.db
      .update(s.notifications)
      .set({ readAt: sql`coalesce(${s.notifications.readAt},now())` })
      .where(
        and(eq(s.notifications.id, id), eq(s.notifications.userId, userId)),
      )
      .returning();
    if (!n) this.fail("NOTIFICATION_NOT_FOUND", "Notification not found.", 404);
    return n;
  }
  async readAll(userId: string) {
    const rows = await this.db
      .update(s.notifications)
      .set({ readAt: new Date() })
      .where(
        and(eq(s.notifications.userId, userId), isNull(s.notifications.readAt)),
      )
      .returning({ id: s.notifications.id });
    return { message: "Notifications marked read.", updatedCount: rows.length };
  }
  async preferences(userId: string) {
    const [p] = await this.db
      .select({
        emailEnabled: s.notificationPreferences.emailEnabled,
        inAppEnabled: s.notificationPreferences.inAppEnabled,
      })
      .from(s.notificationPreferences)
      .where(eq(s.notificationPreferences.userId, userId));
    return p ?? { emailEnabled: true, inAppEnabled: true };
  }
  async updatePreferences(userId: string, input: PreferencesInput) {
    const patch = Object.fromEntries(
      Object.entries(input).filter(([, v]) => v !== undefined),
    );
    if (
      !Object.keys(patch).length ||
      Object.values(patch).some((v) => typeof v !== "boolean")
    )
      this.fail(
        "INVALID_PREFERENCES",
        "Provide boolean notification preferences.",
        400,
      );
    await this.db
      .insert(s.notificationPreferences)
      .values({ userId, ...patch })
      .onConflictDoUpdate({
        target: s.notificationPreferences.userId,
        set: patch,
      });
    return this.preferences(userId);
  }
}
