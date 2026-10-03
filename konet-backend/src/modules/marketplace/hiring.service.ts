import { commissionBreakdown } from "./commission";
import { Inject, Injectable } from "@nestjs/common";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { DATABASE, Database } from "../../database/database.module";
import {
  auditEvents,
  conversationParticipants,
  conversations,
  jobs,
  notifications,
  payments,
  providerProfiles,
  quotes,
  serviceRequests,
  services,
  users,
} from "../../database/schema";
import { DomainError } from "../../common/errors/domain.error";
import { ListQuery, QuoteInput, RequestInput } from "../contracts/contract.dto";
import { visibleCategory } from "../catalog/catalog-visibility";
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type RequestRow = typeof serviceRequests.$inferSelect;
const OPEN = ["pending", "viewed", "discussing", "quoted"] as const;
@Injectable()
export class HiringService {
  constructor(@Inject(DATABASE) private db: Database) {}
  private async providerOwner(providerId: string) {
    const [p] = await this.db
      .select({ userId: providerProfiles.userId })
      .from(providerProfiles)
      .where(eq(providerProfiles.id, providerId))
      .limit(1);
    return p?.userId;
  }
  private async eligible(
    tx: Tx,
    clientId: string,
    providerId: string,
    serviceId: string,
  ) {
    const [initial] = await tx
      .select({ userId: providerProfiles.userId })
      .from(providerProfiles)
      .where(eq(providerProfiles.id, providerId))
      .limit(1);
    if (!initial)
      throw new DomainError(
        "PROVIDER_NOT_FOUND",
        "Provider is unavailable.",
        404,
      );
    if (initial.userId === clientId)
      throw new DomainError(
        "SELF_HIRING_FORBIDDEN",
        "You cannot hire yourself.",
        422,
      );
    const accounts = await tx
      .select()
      .from(users)
      .where(inArray(users.id, [clientId, initial.userId]))
      .orderBy(asc(users.id))
      .for("no key update");
    const client = accounts.find((u) => u.id === clientId);
    const owner = accounts.find((u) => u.id === initial.userId);
    if (
      !client ||
      client.accountStatus !== "active" ||
      client.studentVerificationStatus !== "verified"
    )
      throw new DomainError(
        "STUDENT_VERIFICATION_REQUIRED",
        "An active verified student account is required.",
        403,
      );
    const [provider] = await tx
      .select()
      .from(providerProfiles)
      .where(
        and(
          eq(providerProfiles.id, providerId),
          eq(providerProfiles.status, "active"),
          eq(providerProfiles.reviewStatus, "approved"),
          isNotNull(providerProfiles.approvedAt),
        ),
      )
      .limit(1)
      .for("no key update");
    if (
      !provider ||
      owner?.accountStatus !== "active" ||
      owner.studentVerificationStatus !== "verified"
    )
      throw new DomainError(
        "PROVIDER_NOT_FOUND",
        "Provider is unavailable.",
        404,
      );
    if (provider.availability === "unavailable")
      throw new DomainError(
        "PROVIDER_UNAVAILABLE",
        "Provider is not accepting new work.",
        409,
      );
    const [service] = await tx
      .select()
      .from(services)
      .where(
        and(
          eq(services.id, serviceId),
          eq(services.providerId, providerId),
          eq(services.status, "active"),
          visibleCategory(services.categoryId),
        ),
      )
      .limit(1)
      .for("share");
    if (!service)
      throw new DomainError(
        "SERVICE_NOT_FOUND",
        "Service is unavailable.",
        404,
      );
    if (service.currency !== "NGN")
      throw new DomainError(
        "INVALID_CURRENCY",
        "Hiring currently supports NGN services only.",
        422,
      );
    return { provider, service };
  }
  private async record(
    tx: Tx,
    actorId: string,
    action: string,
    type: string,
    id: string,
    reason?: string,
  ) {
    await tx.insert(auditEvents).values({
      actorId,
      action,
      resourceType: type,
      resourceId: id,
      reason,
      details: {},
    });
  }
  private async notify(
    tx: Tx,
    userId: string,
    type: string,
    resourceType: string,
    resourceId: string,
    body: string,
  ) {
    await tx.insert(notifications).values({
      userId,
      type,
      title: "Hiring update",
      body,
      resourceType,
      resourceId,
    });
  }
  private quoteView(row: typeof quotes.$inferSelect) {
    const view = { ...row, providerAmountMinor: row.amountMinor - row.platformFeeMinor };
    return row.status === "sent" && row.expiresAt <= new Date()
      ? { ...view, status: "expired" as const }
      : view;
  }
  private async authorizedRequest(userId: string, id: string) {
    const [r] = await this.db
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.id, id))
      .limit(1);
    if (
      !r ||
      (r.clientId !== userId &&
        (await this.providerOwner(r.providerId)) !== userId)
    )
      throw new DomainError("REQUEST_NOT_FOUND", "Request not found.", 404);
    return r;
  }
  private async lockRequest(tx: Tx, id: string) {
    const [r] = await tx
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.id, id))
      .limit(1)
      .for("update");
    if (!r)
      throw new DomainError("REQUEST_NOT_FOUND", "Request not found.", 404);
    return r;
  }
  private open(row: RequestRow) {
    if (!OPEN.includes(row.status as (typeof OPEN)[number]))
      throw new DomainError(
        "REQUEST_NOT_OPEN",
        "This request is no longer open.",
        409,
      );
  }
  private validateStatus(q: ListQuery, allowed: string[]) {
    if (q.status && !allowed.includes(q.status))
      throw new DomainError(
        "INVALID_STATUS",
        "Unsupported status filter.",
        400,
      );
  }
  async createRequest(userId: string, input: RequestInput) {
    if (input.description.trim().length < 20)
      throw new DomainError(
        "INVALID_REQUEST_DESCRIPTION",
        "Provide at least 20 meaningful characters.",
        422,
      );
    if (
      input.budgetMinMinor !== undefined &&
      input.budgetMaxMinor !== undefined &&
      input.budgetMinMinor > input.budgetMaxMinor
    )
      throw new DomainError(
        "INVALID_BUDGET",
        "Minimum budget cannot exceed maximum budget.",
        422,
      );
    if (input.requestedAt && new Date(input.requestedAt) <= new Date())
      throw new DomainError(
        "INVALID_REQUEST_DATE",
        "Requested date must be in the future.",
        422,
      );
    return this.db.transaction(async (tx) => {
      const { provider } = await this.eligible(
        tx,
        userId,
        input.providerId,
        input.serviceId,
      );
      const [r] = await tx
        .insert(serviceRequests)
        .values({
          ...input,
          description: input.description.trim(),
          clientId: userId,
          requestedAt: input.requestedAt
            ? new Date(input.requestedAt)
            : undefined,
        })
        .returning();
      await this.record(tx, userId, "request.created", "request", r.id);
      await this.notify(
        tx,
        provider.userId,
        "request_received",
        "request",
        r.id,
        "A client sent you a service request.",
      );
      return r;
    });
  }
  async listRequests(userId: string, q: ListQuery) {
    this.validateStatus(q, [
      "pending",
      "viewed",
      "discussing",
      "quoted",
      "accepted",
      "declined",
      "withdrawn",
      "expired",
      "converted_to_job",
    ]);
    const [p] = await this.db
      .select({ id: providerProfiles.id })
      .from(providerProfiles)
      .where(eq(providerProfiles.userId, userId))
      .limit(1);
    return this.db
      .select()
      .from(serviceRequests)
      .where(
        and(
          p
            ? or(
                eq(serviceRequests.clientId, userId),
                eq(serviceRequests.providerId, p.id),
              )
            : eq(serviceRequests.clientId, userId),
          q.status
            ? eq(serviceRequests.status, q.status as RequestRow["status"])
            : undefined,
        ),
      )
      .orderBy(desc(serviceRequests.createdAt), asc(serviceRequests.id))
      .limit(q.limit ?? 20)
      .offset(q.offset ?? 0);
  }
  async request(userId: string, id: string) {
    return this.authorizedRequest(userId, id);
  }
  async closeRequest(
    userId: string,
    id: string,
    to: "withdrawn" | "declined",
    reason: string,
  ) {
    const initial = await this.authorizedRequest(userId, id);
    const owner = await this.providerOwner(initial.providerId);
    if (
      (to === "withdrawn" && initial.clientId !== userId) ||
      (to === "declined" && owner !== userId)
    )
      throw new DomainError(
        "REQUEST_ACTION_FORBIDDEN",
        "Only the correct participant can close this request.",
        403,
      );
    if (reason.trim().length < 3)
      throw new DomainError(
        "REASON_REQUIRED",
        "Provide a meaningful reason.",
        400,
      );
    return this.db.transaction(async (tx) => {
      const row = await this.lockRequest(tx, id);
      if (row.status === to) return row;
      this.open(row);
      const [updated] = await tx
        .update(serviceRequests)
        .set({ status: to, updatedAt: new Date() })
        .where(eq(serviceRequests.id, id))
        .returning();
      await tx
        .update(quotes)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(
          and(
            eq(quotes.requestId, id),
            inArray(quotes.status, ["sent", "draft"]),
          ),
        );
      await this.record(
        tx,
        userId,
        `request.${to}`,
        "request",
        id,
        reason.trim(),
      );
      await this.notify(
        tx,
        to === "withdrawn" ? owner! : row.clientId,
        `request_${to}`,
        "request",
        id,
        reason.trim(),
      );
      return updated;
    });
  }
  async createQuote(userId: string, input: QuoteInput) {
    const initial = await this.authorizedRequest(userId, input.requestId);
    if ((await this.providerOwner(initial.providerId)) !== userId)
      throw new DomainError(
        "QUOTE_PROVIDER_REQUIRED",
        "Only the assigned provider can quote.",
        403,
      );
    const scope = input.scope.map((s) => s.trim());
    if (scope.some((s) => !s))
      throw new DomainError(
        "INVALID_QUOTE_SCOPE",
        "Scope entries cannot be blank.",
        422,
      );
    if (new Date(input.expiresAt) <= new Date())
      throw new DomainError(
        "INVALID_EXPIRY",
        "Quote expiry must be in the future.",
        422,
      );
    if (input.deliveryAt && new Date(input.deliveryAt) <= new Date())
      throw new DomainError(
        "INVALID_DELIVERY_DATE",
        "Delivery date must be in the future.",
        422,
      );
    return this.db.transaction(async (tx) => {
      const request = await this.lockRequest(tx, input.requestId);
      this.open(request);
      await this.eligible(
        tx,
        request.clientId,
        request.providerId,
        request.serviceId,
      );
      if (request.currency !== "NGN")
        throw new DomainError(
          "INVALID_CURRENCY",
          "Hiring currently supports NGN requests only.",
          422,
        );
      const pricing = commissionBreakdown(input.amountMinor);
      const [q] = await tx
        .insert(quotes)
        .values({
          ...input,
          commissionBasisPoints: pricing.commissionBasisPoints,
          platformFeeMinor: pricing.platformFeeMinor,
          scope,
          providerId: request.providerId,
          clientId: request.clientId,
          currency: request.currency,
          expiresAt: new Date(input.expiresAt),
          deliveryAt: input.deliveryAt ? new Date(input.deliveryAt) : undefined,
        })
        .returning();
      await tx
        .update(serviceRequests)
        .set({ status: "quoted", updatedAt: new Date() })
        .where(eq(serviceRequests.id, request.id));
      await this.record(tx, userId, "quote.sent", "quote", q.id);
      await this.notify(
        tx,
        request.clientId,
        "quote_received",
        "quote",
        q.id,
        "Your provider sent a quote.",
      );
      return this.quoteView(q);
    });
  }
  async requestQuotes(userId: string, id: string, q: ListQuery) {
    await this.authorizedRequest(userId, id);
    return this.db
      .select()
      .from(quotes)
      .where(eq(quotes.requestId, id))
      .orderBy(desc(quotes.createdAt), asc(quotes.id))
      .limit(q.limit ?? 20)
      .offset(q.offset ?? 0)
      .then((rows) => rows.map((r) => this.quoteView(r)));
  }
  async listQuotes(userId: string, q: ListQuery) {
    this.validateStatus(q, [
      "draft",
      "sent",
      "accepted",
      "declined",
      "expired",
      "cancelled",
    ]);
    const [p] = await this.db
      .select({ id: providerProfiles.id })
      .from(providerProfiles)
      .where(eq(providerProfiles.userId, userId))
      .limit(1);
    const status = sql<string>`CASE WHEN ${quotes.status} = 'sent' AND ${quotes.expiresAt} <= now() THEN 'expired' ELSE ${quotes.status}::text END`;
    return this.db
      .select()
      .from(quotes)
      .where(
        and(
          p
            ? or(eq(quotes.clientId, userId), eq(quotes.providerId, p.id))
            : eq(quotes.clientId, userId),
          q.status ? sql`${status} = ${q.status}` : undefined,
        ),
      )
      .orderBy(desc(quotes.createdAt), asc(quotes.id))
      .limit(q.limit ?? 20)
      .offset(q.offset ?? 0)
      .then((rows) => rows.map((r) => this.quoteView(r)));
  }
  async quote(userId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(quotes)
      .where(eq(quotes.id, id))
      .limit(1);
    if (
      !row ||
      (row.clientId !== userId &&
        (await this.providerOwner(row.providerId)) !== userId)
    )
      throw new DomainError("QUOTE_NOT_FOUND", "Quote not found.", 404);
    return this.quoteView(row);
  }
  async closeQuote(
    userId: string,
    id: string,
    to: "declined" | "cancelled",
    reason: string,
  ) {
    const initial = await this.quote(userId, id);
    if (
      (to === "declined" && initial.clientId !== userId) ||
      (to === "cancelled" &&
        (await this.providerOwner(initial.providerId)) !== userId)
    )
      throw new DomainError(
        "QUOTE_ACTION_FORBIDDEN",
        "Only the correct participant can perform this action.",
        403,
      );
    if (reason.trim().length < 3)
      throw new DomainError(
        "REASON_REQUIRED",
        "Provide a meaningful reason.",
        400,
      );
    return this.db.transaction(async (tx) => {
      const request = await this.lockRequest(tx, initial.requestId);
      const [q] = await tx
        .select()
        .from(quotes)
        .where(eq(quotes.id, id))
        .limit(1)
        .for("update");
      if (q.status === to) return this.quoteView(q);
      this.open(request);
      if (q.status !== "sent" || q.expiresAt <= new Date())
        throw new DomainError(
          "QUOTE_NOT_ACTIONABLE",
          "Quote is no longer available.",
          409,
        );
      const [updated] = await tx
        .update(quotes)
        .set({ status: to, updatedAt: new Date() })
        .where(eq(quotes.id, id))
        .returning();
      await this.record(tx, userId, `quote.${to}`, "quote", id, reason.trim());
      await this.notify(
        tx,
        to === "declined"
          ? (await this.providerOwner(q.providerId))!
          : q.clientId,
        `quote_${to}`,
        "quote",
        id,
        reason.trim(),
      );
      return this.quoteView(updated);
    });
  }
  async accept(userId: string, id: string) {
    const initial = await this.quote(userId, id);
    if (initial.clientId !== userId)
      throw new DomainError(
        "QUOTE_CLIENT_REQUIRED",
        "Only the quoted client can accept.",
        403,
      );
    return this.db.transaction(async (tx) => {
      const request = await this.lockRequest(tx, initial.requestId);
      const [q] = await tx
        .select()
        .from(quotes)
        .where(eq(quotes.id, id))
        .limit(1)
        .for("update");
      const [existing] = await tx
        .select()
        .from(jobs)
        .where(eq(jobs.requestId, request.id))
        .limit(1);
      if (existing) {
        if (existing.quoteId === id && existing.clientId === userId)
          return existing;
        throw new DomainError(
          "REQUEST_ALREADY_CONVERTED",
          "Another quote already created a job for this request.",
          409,
        );
      }
      this.open(request);
      if (q.status !== "sent" || q.expiresAt <= new Date())
        throw new DomainError(
          "QUOTE_NOT_ACCEPTABLE",
          "Quote is expired or no longer available.",
          409,
        );
      if (q.deliveryAt && q.deliveryAt <= new Date())
        throw new DomainError(
          "QUOTE_DELIVERY_PASSED",
          "Ask the provider for an updated delivery date.",
          409,
        );
      const { provider } = await this.eligible(
        tx,
        request.clientId,
        request.providerId,
        request.serviceId,
      );
      if (q.currency !== "NGN" || q.currency !== request.currency)
        throw new DomainError(
          "INVALID_CURRENCY",
          "Quote and request currency must match NGN.",
          422,
        );
      await tx
        .update(quotes)
        .set({ status: "accepted", updatedAt: new Date() })
        .where(eq(quotes.id, id));
      await tx
        .update(quotes)
        .set({ status: "declined", updatedAt: new Date() })
        .where(
          and(
            eq(quotes.requestId, request.id),
            ne(quotes.id, id),
            inArray(quotes.status, ["sent", "draft"]),
          ),
        );
      await tx
        .update(serviceRequests)
        .set({ status: "converted_to_job", updatedAt: new Date() })
        .where(eq(serviceRequests.id, request.id));
      const [job] = await tx
        .insert(jobs)
        .values({
          requestId: request.id,
          quoteId: id,
          clientId: q.clientId,
          providerId: q.providerId,
          serviceId: request.serviceId,
          agreedAmountMinor: q.amountMinor,
          currency: q.currency,
        })
        .returning();
      await tx.insert(payments).values({
        jobId: job.id,
        payerId: q.clientId,
        providerId: q.providerId,
        amountMinor: q.amountMinor,
        platformFeeMinor: q.platformFeeMinor,
        providerAmountMinor: q.amountMinor - q.platformFeeMinor,
        currency: q.currency,
        idempotencyKey: `quote:${id}`,
      });
      const [conversation] = await tx
        .insert(conversations)
        .values({ requestId: request.id, jobId: job.id })
        .returning();
      await tx.insert(conversationParticipants).values([
        { conversationId: conversation.id, userId: q.clientId },
        { conversationId: conversation.id, userId: provider.userId },
      ]);
      await this.record(tx, userId, "quote.accepted", "quote", id);
      await this.notify(
        tx,
        provider.userId,
        "quote_accepted",
        "job",
        job.id,
        "A client accepted your quote.",
      );
      return job;
    });
  }
  async conversation(userId: string, id: string) {
    await this.authorizedRequest(userId, id);
    const [c] = await this.db
      .select()
      .from(conversations)
      .where(eq(conversations.requestId, id))
      .orderBy(asc(conversations.createdAt), asc(conversations.id))
      .limit(1);
    if (!c)
      throw new DomainError(
        "CONVERSATION_NOT_FOUND",
        "Conversation is created when a quote becomes a job.",
        404,
      );
    return c;
  }
}
