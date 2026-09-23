import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, gt, or } from "drizzle-orm";
import { DATABASE, Database } from "../../database/database.module";
import {
  conversationParticipants,
  conversations,
  disputes,
  jobs,
  messages,
  notifications,
  payments,
  providerProfiles,
  quotes,
  reviews,
  serviceRequests,
  services,
  users,
} from "../../database/schema";
import { DomainError } from "../../common/errors/domain.error";
import {
  CreateQuoteDto,
  CreateRequestDto,
  CreateServiceDto,
  DisputeDto,
  MessageDto,
  ReviewDto,
  UpdateServiceDto,
} from "./dto";
import { assertJobTransition, JobState } from "./job-state-machine";
@Injectable()
export class MarketplaceService {
  constructor(@Inject(DATABASE) private db: Database) {}
  private async providerFor(userId: string) {
    const [p] = await this.db
      .select()
      .from(providerProfiles)
      .where(eq(providerProfiles.userId, userId))
      .limit(1);
    if (!p)
      throw new DomainError(
        "PROVIDER_REQUIRED",
        "A provider profile is required.",
        403,
      );
    return p;
  }
  async createService(userId: string, d: CreateServiceDto) {
    const p = await this.providerFor(userId);
    if (p.status !== "active")
      throw new DomainError(
        "PROVIDER_NOT_APPROVED",
        "Provider verification must be approved before publishing services.",
        403,
      );
    const [s] = await this.db
      .insert(services)
      .values({ providerId: p.id, ...d })
      .returning();
    return s;
  }
  async myServices(userId: string) {
    const p = await this.providerFor(userId);
    return this.db.select().from(services).where(eq(services.providerId, p.id));
  }
  async updateService(userId: string, id: string, d: UpdateServiceDto) {
    const p = await this.providerFor(userId);
    if (d.status === "active" && p.status !== "active")
      throw new DomainError("PROVIDER_NOT_APPROVED", "Provider verification must be approved before publishing services.", 403);
    const [service] = await this.db.update(services).set({ ...d, updatedAt: new Date() }).where(and(eq(services.id, id), eq(services.providerId, p.id))).returning();
    if (!service) throw new DomainError("SERVICE_NOT_FOUND", "Service not found.", 404);
    return service;
  }
  async archiveService(userId: string, id: string) {
    return this.updateService(userId, id, { status: "archived" });
  }
  async request(userId: string, d: CreateRequestDto) {
    const [client] = await this.db
      .select({ verification: users.studentVerificationStatus })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (client?.verification !== "verified")
      throw new DomainError(
        "STUDENT_VERIFICATION_REQUIRED",
        "Verify your student status before hiring a provider.",
        403,
      );
    const [p] = await this.db
      .select()
      .from(providerProfiles)
      .where(
        and(
          eq(providerProfiles.id, d.providerId),
          eq(providerProfiles.status, "active"),
        ),
      )
      .limit(1);
    if (!p)
      throw new DomainError(
        "PROVIDER_NOT_FOUND",
        "Provider is unavailable.",
        404,
      );
    if (p.userId === userId)
      throw new DomainError(
        "SELF_HIRING_FORBIDDEN",
        "You cannot hire yourself.",
        422,
      );
    const [s] = await this.db
      .select()
      .from(services)
      .where(
        and(
          eq(services.id, d.serviceId),
          eq(services.providerId, p.id),
          eq(services.status, "active"),
        ),
      )
      .limit(1);
    if (!s)
      throw new DomainError(
        "SERVICE_NOT_FOUND",
        "Service is unavailable.",
        404,
      );
    if (
      d.budgetMinMinor != null &&
      d.budgetMaxMinor != null &&
      d.budgetMinMinor > d.budgetMaxMinor
    )
      throw new DomainError(
        "INVALID_BUDGET",
        "Minimum budget cannot exceed maximum budget.",
        422,
      );
    const [r] = await this.db
      .insert(serviceRequests)
      .values({
        ...d,
        clientId: userId,
        requestedAt: d.requestedAt ? new Date(d.requestedAt) : undefined,
      })
      .returning();
    return r;
  }
  async listRequests(userId: string) {
    const p = await this.db
      .select({ id: providerProfiles.id })
      .from(providerProfiles)
      .where(eq(providerProfiles.userId, userId))
      .limit(1);
    return this.db
      .select()
      .from(serviceRequests)
      .where(
        p[0]
          ? or(
              eq(serviceRequests.clientId, userId),
              eq(serviceRequests.providerId, p[0].id),
            )
          : eq(serviceRequests.clientId, userId),
      )
      .orderBy(desc(serviceRequests.createdAt));
  }
  async quote(userId: string, d: CreateQuoteDto) {
    const p = await this.providerFor(userId);
    const [r] = await this.db
      .select()
      .from(serviceRequests)
      .where(
        and(
          eq(serviceRequests.id, d.requestId),
          eq(serviceRequests.providerId, p.id),
          eq(serviceRequests.status, "pending"),
        ),
      )
      .limit(1);
    if (!r)
      throw new DomainError(
        "REQUEST_NOT_AVAILABLE",
        "Request is not available to quote.",
        404,
      );
    if (new Date(d.expiresAt) <= new Date())
      throw new DomainError(
        "INVALID_EXPIRY",
        "Quote expiry must be in the future.",
        422,
      );
    const [q] = await this.db
      .insert(quotes)
      .values({
        ...d,
        providerId: p.id,
        clientId: r.clientId,
        deliveryAt: d.deliveryAt ? new Date(d.deliveryAt) : undefined,
        expiresAt: new Date(d.expiresAt),
      })
      .returning();
    return q;
  }
  async acceptQuote(userId: string, quoteId: string) {
    return this.db.transaction(async (tx) => {
      const [q] = await tx
        .select()
        .from(quotes)
        .where(
          and(
            eq(quotes.id, quoteId),
            eq(quotes.clientId, userId),
            eq(quotes.status, "sent"),
            gt(quotes.expiresAt, new Date()),
          ),
        )
        .limit(1);
      if (!q)
        throw new DomainError(
          "QUOTE_NOT_ACCEPTABLE",
          "Quote is unavailable, expired, or belongs to another client.",
          409,
        );
      const accepted = await tx
        .update(quotes)
        .set({ status: "accepted", updatedAt: new Date() })
        .where(and(eq(quotes.id, q.id), eq(quotes.status, "sent")))
        .returning();
      if (!accepted.length)
        throw new DomainError(
          "QUOTE_ALREADY_HANDLED",
          "Quote has already been handled.",
          409,
        );
      await tx
        .update(quotes)
        .set({ status: "declined", updatedAt: new Date() })
        .where(
          and(eq(quotes.requestId, q.requestId), eq(quotes.status, "sent")),
        );
      await tx
        .update(serviceRequests)
        .set({ status: "accepted", updatedAt: new Date() })
        .where(
          and(
            eq(serviceRequests.id, q.requestId),
            eq(serviceRequests.status, "pending"),
          ),
        );
      const [r] = await tx
        .select()
        .from(serviceRequests)
        .where(eq(serviceRequests.id, q.requestId))
        .limit(1);
      const [job] = await tx
        .insert(jobs)
        .values({
          requestId: q.requestId,
          quoteId: q.id,
          clientId: q.clientId,
          providerId: q.providerId,
          serviceId: r.serviceId,
          agreedAmountMinor: q.amountMinor,
          currency: q.currency,
        })
        .returning();
      await tx
        .insert(payments)
        .values({
          jobId: job.id,
          payerId: q.clientId,
          providerId: q.providerId,
          amountMinor: q.amountMinor,
          providerAmountMinor: q.amountMinor,
          currency: q.currency,
          idempotencyKey: `quote:${q.id}`,
        });
      const [c] = await tx
        .insert(conversations)
        .values({ requestId: q.requestId, jobId: job.id })
        .returning();
      const [p] = await tx
        .select({ userId: providerProfiles.userId })
        .from(providerProfiles)
        .where(eq(providerProfiles.id, q.providerId))
        .limit(1);
      await tx.insert(conversationParticipants).values([
        { conversationId: c.id, userId: q.clientId },
        { conversationId: c.id, userId: p.userId },
      ]);
      await tx
        .insert(notifications)
        .values({
          userId: p.userId,
          type: "quote_accepted",
          title: "Quote accepted",
          body: "A client accepted your quote.",
          resourceType: "job",
          resourceId: job.id,
        });
      return job;
    });
  }
  async jobs(userId: string) {
    const p = await this.db
      .select({ id: providerProfiles.id })
      .from(providerProfiles)
      .where(eq(providerProfiles.userId, userId))
      .limit(1);
    return this.db
      .select()
      .from(jobs)
      .where(
        p[0]
          ? or(eq(jobs.clientId, userId), eq(jobs.providerId, p[0].id))
          : eq(jobs.clientId, userId),
      )
      .orderBy(desc(jobs.createdAt));
  }
  async transition(userId: string, id: string, to: JobState) {
    return this.db.transaction(async (tx) => {
      const [j] = await tx.select().from(jobs).where(eq(jobs.id, id)).limit(1);
      if (!j) throw new DomainError("JOB_NOT_FOUND", "Job not found.", 404);
      const p = await tx
        .select({ id: providerProfiles.id })
        .from(providerProfiles)
        .where(eq(providerProfiles.userId, userId))
        .limit(1);
      const isClient = j.clientId === userId,
        isProvider = p[0]?.id === j.providerId;
      if (!isClient && !isProvider)
        throw new DomainError(
          "JOB_FORBIDDEN",
          "You are not a participant in this job.",
          403,
        );
      if (
        (to === "in_progress" && !isProvider) ||
        (to === "awaiting_client_confirmation" && !isProvider) ||
        (to === "completed" && !isClient)
      )
        throw new DomainError(
          "JOB_ACTION_FORBIDDEN",
          "Only the correct job participant can perform this action.",
          403,
        );
      assertJobTransition(j.status as JobState, to);
      const now = new Date();
      const patch: any = { status: to, updatedAt: now };
      if (to === "in_progress") patch.startedAt = now;
      if (to === "awaiting_client_confirmation") patch.providerCompletedAt = now;
      if (to === "completed") {
        patch.clientConfirmedAt = now;
        patch.completedAt = now;
        await tx
          .update(payments)
          .set({ status: "released", updatedAt: now })
          .where(and(eq(payments.jobId, id), eq(payments.status, "held")));
      }
      const [out] = await tx
        .update(jobs)
        .set(patch)
        .where(and(eq(jobs.id, id), eq(jobs.status, j.status)))
        .returning();
      if (!out)
        throw new DomainError(
          "JOB_CONFLICT",
          "Job changed while processing the action.",
          409,
        );
      return out;
    });
  }
  async messages(userId: string, conversationId: string) {
    await this.assertParticipant(userId, conversationId);
    return this.db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);
  }
  async send(userId: string, conversationId: string, d: MessageDto) {
    await this.assertParticipant(userId, conversationId);
    const [m] = await this.db
      .insert(messages)
      .values({ conversationId, senderId: userId, content: d.content })
      .returning();
    return m;
  }
  private async assertParticipant(userId: string, cid: string) {
    const [p] = await this.db
      .select()
      .from(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.conversationId, cid),
          eq(conversationParticipants.userId, userId),
        ),
      )
      .limit(1);
    if (!p)
      throw new DomainError(
        "CONVERSATION_FORBIDDEN",
        "Conversation access denied.",
        403,
      );
  }
  async review(userId: string, d: ReviewDto) {
    const [j] = await this.db
      .select()
      .from(jobs)
      .where(
        and(
          eq(jobs.id, d.jobId),
          eq(jobs.clientId, userId),
          eq(jobs.status, "completed"),
        ),
      )
      .limit(1);
    if (!j)
      throw new DomainError(
        "REVIEW_NOT_ALLOWED",
        "Only the client can review a completed job.",
        403,
      );
    try {
      const [r] = await this.db
        .insert(reviews)
        .values({ ...d, clientId: userId, providerId: j.providerId })
        .returning();
      return r;
    } catch {
      throw new DomainError(
        "REVIEW_EXISTS",
        "This job has already been reviewed.",
        409,
      );
    }
  }
  async notifications(userId: string) {
    return this.db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }
  async readNotification(userId: string, id: string) {
    const [n] = await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();
    if (!n)
      throw new DomainError(
        "NOTIFICATION_NOT_FOUND",
        "Notification not found.",
        404,
      );
    return n;
  }
  async dispute(userId: string, jobId: string, d: DisputeDto) {
    return this.db.transaction(async (tx) => {
      const [j] = await tx
        .select()
        .from(jobs)
        .where(eq(jobs.id, jobId))
        .limit(1);
      const p = await tx
        .select({ id: providerProfiles.id })
        .from(providerProfiles)
        .where(eq(providerProfiles.userId, userId))
        .limit(1);
      if (!j || (j.clientId !== userId && j.providerId !== p[0]?.id))
        throw new DomainError(
          "JOB_FORBIDDEN",
          "You cannot dispute this job.",
          403,
        );
      if (
        !["scheduled", "in_progress", "awaiting_client_confirmation"].includes(
          j.status,
        )
      )
        throw new DomainError(
          "DISPUTE_NOT_ALLOWED",
          "This job cannot be disputed in its current state.",
          409,
        );
      const [dsp] = await tx
        .insert(disputes)
        .values({ jobId, openedByUserId: userId, ...d })
        .returning();
      await tx
        .update(jobs)
        .set({ status: "disputed", updatedAt: new Date() })
        .where(eq(jobs.id, jobId));
      await tx
        .update(payments)
        .set({ status: "disputed", updatedAt: new Date() })
        .where(eq(payments.jobId, jobId));
      return dsp;
    });
  }
}
