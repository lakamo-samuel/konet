import { RealtimePublisher, LiveEvent } from "../realtime/realtime.publisher";
import {
  Inject,
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { createHmac, randomUUID } from "node:crypto";
import { DATABASE, Database } from "../../database/database.module";
import * as s from "../../database/schema";
import { PaystackGateway } from "../../infrastructure/payments/paystack.gateway";
import { DomainError } from "../../common/errors/domain.error";
import {
  ListQuery,
  PayoutAccountInput,
  RefundInput,
} from "../contracts/contract.dto";
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
export async function queueClientPayout(
  tx: Tx,
  job: typeof s.jobs.$inferSelect,
  payment: typeof s.payments.$inferSelect,
) {
  const [existing] = await tx
    .select()
    .from(s.payouts)
    .where(eq(s.payouts.jobId, job.id));
  if (existing) return existing;
  const [account] = await tx
    .select()
    .from(s.payoutAccounts)
    .where(
      and(
        eq(s.payoutAccounts.providerId, job.providerId),
        eq(s.payoutAccounts.active, true),
      ),
    )
    .for("share");
  const id = randomUUID();
  const [out] = await tx
    .insert(s.payouts)
    .values({
      id,
      jobId: job.id,
      paymentId: payment.id,
      providerId: job.providerId,
      amountMinor: payment.providerAmountMinor,
      currency: payment.currency,
      reference: `konet-payout-${id}`,
      accountId: account?.id,
      recipientCode: account?.recipientCode,
    })
    .returning();
  await tx
    .update(s.payments)
    .set({ status: "release_pending", updatedAt: new Date() })
    .where(eq(s.payments.id, payment.id));
  return out;
}
@Injectable()
export class SettlementService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;
  constructor(
    @Inject(DATABASE) private db: Database,
    private gateway: PaystackGateway,
    private config: ConfigService,
    private realtime: RealtimePublisher,
  ) {}
  onModuleInit() {
    if (this.config.get("NODE_ENV") === "test") return;
    this.timer = setInterval(() => {
      void this.drain();
    }, 30000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  private fail(code: string, message: string, status = 409): never {
    throw new DomainError(code, message, status);
  }
  private async provider(
    userId: string,
    tx: Database | Tx = this.db,
    lock = false,
  ) {
    const query = tx
      .select()
      .from(s.providerProfiles)
      .where(eq(s.providerProfiles.userId, userId));
    const [p] = await (lock ? query.for("update") : query);
    if (!p) this.fail("PROVIDER_REQUIRED", "Provider profile required.", 403);
    return p;
  }
  private accountView(a: typeof s.payoutAccounts.$inferSelect) {
    const {
      id,
      providerId,
      bankCode,
      accountName,
      accountNumberLast4,
      status,
      createdAt,
    } = a;
    return {
      id,
      providerId,
      bankCode,
      accountName,
      accountNumberLast4,
      status,
      createdAt,
    };
  }
  private payoutView(p: typeof s.payouts.$inferSelect) {
    const {
      id,
      jobId,
      paymentId,
      amountMinor,
      currency,
      status,
      reference,
      createdAt,
    } = p;
    return {
      id,
      jobId,
      paymentId,
      amountMinor,
      currency,
      status,
      reference,
      createdAt,
    };
  }
  private refundView(r: typeof s.refunds.$inferSelect) {
    const { id, paymentId, amountMinor, currency, reason, status, createdAt } =
      r;
    return { id, paymentId, amountMinor, currency, reason, status, createdAt };
  }
  private async financeNotice(
    tx: Tx,
    payment: typeof s.payments.$inferSelect,
    type: string,
    title: string,
    events: LiveEvent[],
  ) {
    const [provider] = await tx
      .select()
      .from(s.providerProfiles)
      .where(eq(s.providerProfiles.id, payment.providerId));
    const records = await tx
      .insert(s.notifications)
      .values(
        [payment.payerId, provider.userId].map((userId) => ({
          userId,
          type,
          title,
          body: title,
          resourceType: "job",
          resourceId: payment.jobId,
        })),
      )
      .returning();
    for (const notice of records)
      events.push({
        userId: notice.userId,
        event: "notification.new",
        payload: notice,
      });
  }
  async banks() {
    return this.gateway.listBanks();
  }
  async accounts(userId: string) {
    const p = await this.provider(userId);
    return (
      await this.db
        .select()
        .from(s.payoutAccounts)
        .where(
          and(
            eq(s.payoutAccounts.providerId, p.id),
            eq(s.payoutAccounts.active, true),
          ),
        )
    ).map((a) => this.accountView(a));
  }
  async addAccount(userId: string, input: PayoutAccountInput) {
    if (!/^[0-9]{3,9}$/.test(input.bankCode))
      this.fail("INVALID_BANK_CODE", "Use a Nigerian bank code.", 422);
    const fingerprint = createHmac(
      "sha256",
      this.config.getOrThrow<string>("JWT_REFRESH_SECRET"),
    )
      .update(`${input.bankCode}:${input.accountNumber}`)
      .digest("hex");
    return this.db.transaction(async (tx) => {
      const p = await this.provider(userId, tx, true);
      if (p.reviewStatus !== "approved" || p.status === "suspended")
        this.fail("PROVIDER_NOT_APPROVED", "Approved provider required.", 403);
      const [existing] = await tx
        .select()
        .from(s.payoutAccounts)
        .where(
          and(
            eq(s.payoutAccounts.providerId, p.id),
            eq(s.payoutAccounts.active, true),
          ),
        );
      if (existing) {
        if (existing.fingerprint === fingerprint)
          return this.accountView(existing);
        this.fail(
          "PAYOUT_ACCOUNT_EXISTS",
          "Remove the existing payout account before replacing it.",
        );
      }
      const recipient = await this.gateway.resolveRecipient(
        input.bankCode,
        input.accountNumber,
      );
      const [out] = await tx
        .insert(s.payoutAccounts)
        .values({
          providerId: p.id,
          bankCode: input.bankCode,
          accountName: recipient.accountName,
          recipientCode: recipient.recipientCode,
          accountNumberLast4: input.accountNumber.slice(-4),
          fingerprint,
        })
        .returning();
      await tx.insert(s.auditEvents).values({
        actorId: userId,
        action: "payout_account.created",
        resourceType: "payout_account",
        resourceId: out.id,
        details: {
          providerId: p.id,
          bankCode: input.bankCode,
          last4: out.accountNumberLast4,
        },
      });
      return this.accountView(out);
    });
  }
  async removeAccount(userId: string, id: string) {
    await this.db.transaction(async (tx) => {
      const p = await this.provider(userId, tx, true);
      const [account] = await tx
        .select()
        .from(s.payoutAccounts)
        .where(
          and(
            eq(s.payoutAccounts.id, id),
            eq(s.payoutAccounts.providerId, p.id),
            eq(s.payoutAccounts.active, true),
          ),
        )
        .for("update");
      if (!account)
        this.fail("PAYOUT_ACCOUNT_NOT_FOUND", "Payout account not found.", 404);
      const [pending] = await tx
        .select()
        .from(s.payouts)
        .where(
          and(
            eq(s.payouts.accountId, id),
            inArray(s.payouts.status, ["pending", "processing"]),
          ),
        );
      if (pending)
        this.fail(
          "PAYOUT_ACCOUNT_IN_USE",
          "A pending payout uses this account.",
        );
      await tx
        .update(s.payoutAccounts)
        .set({ active: false })
        .where(eq(s.payoutAccounts.id, id));
      await tx.insert(s.auditEvents).values({
        actorId: userId,
        action: "payout_account.removed",
        resourceType: "payout_account",
        resourceId: id,
        details: { providerId: p.id },
      });
    });
  }
  private async ownedJob(userId: string, jobId: string) {
    const [row] = await this.db
      .select({ job: s.jobs })
      .from(s.jobs)
      .innerJoin(
        s.providerProfiles,
        eq(s.providerProfiles.id, s.jobs.providerId),
      )
      .where(
        and(
          eq(s.jobs.id, jobId),
          sql`(${s.jobs.clientId}=${userId} OR ${s.providerProfiles.userId}=${userId})`,
        ),
      );
    if (!row) this.fail("JOB_NOT_FOUND", "Job not found.", 404);
    return row.job;
  }
  async payout(userId: string, jobId: string) {
    await this.ownedJob(userId, jobId);
    const [p] = await this.db
      .select()
      .from(s.payouts)
      .where(eq(s.payouts.jobId, jobId));
    if (!p) this.fail("PAYOUT_NOT_FOUND", "Payout is not queued yet.", 404);
    return this.payoutView(p);
  }
  async jobRefunds(userId: string, jobId: string) {
    await this.ownedJob(userId, jobId);
    const [payment] = await this.db
      .select()
      .from(s.payments)
      .where(eq(s.payments.jobId, jobId));
    return payment
      ? (
          await this.db
            .select()
            .from(s.refunds)
            .where(eq(s.refunds.paymentId, payment.id))
        ).map((r) => this.refundView(r))
      : [];
  }
  async ownPayouts(userId: string, q: ListQuery) {
    const p = await this.provider(userId);
    if (
      q.status &&
      !["pending", "processing", "succeeded", "failed", "cancelled"].includes(
        q.status,
      )
    )
      this.fail("INVALID_STATUS", "Invalid payout status.", 400);
    return (
      await this.db
        .select()
        .from(s.payouts)
        .where(
          and(
            eq(s.payouts.providerId, p.id),
            q.status ? eq(s.payouts.status, q.status) : undefined,
          ),
        )
        .orderBy(desc(s.payouts.createdAt), s.payouts.id)
        .limit(q.limit ?? 20)
        .offset(q.offset ?? 0)
    ).map((row) => this.payoutView(row));
  }
  async earnings(userId: string) {
    const p = await this.provider(userId);
    const payments = await this.db
      .select({
        amount: s.payments.providerAmountMinor,
        status: s.payments.status,
        jobStatus: s.jobs.status,
      })
      .from(s.payments)
      .innerJoin(s.jobs, eq(s.jobs.id, s.payments.jobId))
      .where(eq(s.payments.providerId, p.id));
    let earnedMinor = 0,
      pendingMinor = 0,
      paidOutMinor = 0;
    for (const row of payments) {
      if (
        row.jobStatus === "completed" &&
        ["funded", "held", "release_pending", "released"].includes(row.status)
      )
        earnedMinor += row.amount;
      if (row.status === "released") paidOutMinor += row.amount;
      else if (
        row.jobStatus === "completed" &&
        ["funded", "held", "release_pending"].includes(row.status)
      )
        pendingMinor += row.amount;
    }
    return { currency: "NGN", earnedMinor, pendingMinor, paidOutMinor };
  }
  async requestRefund(actorId: string, paymentId: string, input: RefundInput) {
    if (
      !input.reason.trim() ||
      input.reason.trim().length < 3 ||
      input.reason.length > 2000
    )
      this.fail(
        "INVALID_REASON",
        "Provide a refund reason of 3–2000 characters.",
        422,
      );
    return this.db.transaction(async (tx) => {
      const [initial] = await tx
        .select()
        .from(s.payments)
        .where(eq(s.payments.id, paymentId));
      if (!initial) this.fail("PAYMENT_NOT_FOUND", "Payment not found.", 404);
      const [job] = await tx
        .select()
        .from(s.jobs)
        .where(eq(s.jobs.id, initial.jobId))
        .for("update");
      const [payment] = await tx
        .select()
        .from(s.payments)
        .where(eq(s.payments.id, paymentId))
        .for("update");
      const [provider] = await tx
        .select()
        .from(s.providerProfiles)
        .where(eq(s.providerProfiles.id, job.providerId));
      if (actorId === payment.payerId || actorId === provider.userId)
        this.fail(
          "SELF_REFUND_FORBIDDEN",
          "Another authorized staff member must approve this refund.",
          403,
        );
      if (input.amountMinor !== payment.amountMinor)
        this.fail(
          "FULL_REFUND_REQUIRED",
          "Only full refunds are supported in this stage.",
          422,
        );
      const [existing] = await tx
        .select()
        .from(s.refunds)
        .where(eq(s.refunds.paymentId, paymentId));
      if (existing) return this.refundView(existing);
      const [payout] = await tx
        .select()
        .from(s.payouts)
        .where(eq(s.payouts.paymentId, paymentId));
      if (payout)
        this.fail(
          "PAYOUT_RESERVED",
          "A queued or completed payout blocks this refund.",
        );
      const [dispute] = await tx
        .select()
        .from(s.disputes)
        .where(
          and(
            eq(s.disputes.jobId, job.id),
            inArray(s.disputes.status, ["open", "under_review"]),
          ),
        );
      if (dispute)
        this.fail(
          "DISPUTE_RESOLUTION_REQUIRED",
          "Resolve the dispute before refunding.",
        );
      if (
        !["funded", "held"].includes(payment.status) ||
        payment.gateway !== "paystack" ||
        payment.currency !== "NGN" ||
        !payment.gatewayReference ||
        job.status === "completed"
      )
        this.fail("REFUND_NOT_ALLOWED", "This payment cannot be refunded.");
      const [proof] = await tx
        .select()
        .from(s.paymentEvents)
        .where(
          and(
            eq(s.paymentEvents.paymentId, payment.id),
            eq(s.paymentEvents.type, "charge.success"),
          ),
        );
      if (!proof)
        this.fail(
          "PAYMENT_PROOF_REQUIRED",
          "Verified collection is required before refunding.",
        );
      const [out] = await tx
        .insert(s.refunds)
        .values({
          paymentId,
          amountMinor: payment.amountMinor,
          currency: payment.currency,
          reason: input.reason.trim(),
          actorId,
        })
        .returning();
      await tx
        .update(s.jobs)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(s.jobs.id, job.id));
      await tx.insert(s.auditEvents).values({
        actorId,
        action: "refund.authorized",
        resourceType: "refund",
        resourceId: out.id,
        reason: input.reason.trim(),
        details: {
          paymentId,
          amountMinor: payment.amountMinor,
          jobId: job.id,
        },
      });
      return this.refundView(out);
    });
  }
  async retryPayout(actorId: string, id: string, reason: string) {
    if (reason.trim().length < 3)
      this.fail("INVALID_REASON", "Provide a retry reason.", 422);
    const [p] = await this.db
      .select()
      .from(s.payouts)
      .where(eq(s.payouts.id, id));
    if (!p) this.fail("PAYOUT_NOT_FOUND", "Payout not found.", 404);
    const verified = await this.gateway.verifyTransfer(p.reference);
    if (
      verified.status !== "failed" ||
      verified.reference !== p.reference ||
      verified.amountMinor !== p.amountMinor ||
      verified.currency !== p.currency ||
      verified.recipientCode !== p.recipientCode
    )
      this.fail(
        "PAYOUT_RETRY_NOT_SAFE",
        "Paystack must confirm the original transfer failed.",
      );
    return this.db.transaction(async (tx) => {
      await tx
        .select()
        .from(s.jobs)
        .where(eq(s.jobs.id, p.jobId))
        .for("update");
      const [row] = await tx
        .select()
        .from(s.payouts)
        .where(eq(s.payouts.id, id))
        .for("update");
      if (row.status !== "failed" || row.gatewayStatus !== "failed")
        this.fail(
          "PAYOUT_RETRY_NOT_SAFE",
          "Only a confirmed failed payout may be retried.",
        );
      const [account] = row.accountId
        ? await tx
            .select()
            .from(s.payoutAccounts)
            .where(
              and(
                eq(s.payoutAccounts.id, row.accountId),
                eq(s.payoutAccounts.active, true),
              ),
            )
        : [];
      if (!account)
        this.fail(
          "PAYOUT_ACCOUNT_REQUIRED",
          "The original payout account is unavailable.",
        );
      const [out] = await tx
        .update(s.payouts)
        .set({
          status: "pending",
          attemptedAt: null,
          leaseUntil: null,
          updatedAt: new Date(),
        })
        .where(eq(s.payouts.id, id))
        .returning();
      await tx.insert(s.auditEvents).values({
        actorId,
        action: "payout.retry_authorized",
        resourceType: "payout",
        resourceId: id,
        reason,
        details: { reference: p.reference },
      });
      return this.payoutView(out);
    });
  }
  async drain() {
    if (this.running) return;
    this.running = true;
    try {
      if (this.config.get<boolean>("PAYSTACK_TRANSFERS_ENABLED") === true) {
        const rows = await this.db
          .select({ id: s.payouts.id })
          .from(s.payouts)
          .where(
            and(
              inArray(s.payouts.status, ["pending", "processing"]),
              sql`(${s.payouts.leaseUntil} IS NULL OR ${s.payouts.leaseUntil} <= now())`,
            ),
          )
          .orderBy(s.payouts.updatedAt, s.payouts.id)
          .limit(10);
        for (const row of rows)
          await this.processPayout(row.id).catch(() => undefined);
      }
      const refunds = await this.db
        .select({ id: s.refunds.id })
        .from(s.refunds)
        .where(
          and(
            inArray(s.refunds.status, ["pending", "processing"]),
            sql`(${s.refunds.leaseUntil} IS NULL OR ${s.refunds.leaseUntil} <= now())`,
          ),
        )
        .orderBy(s.refunds.updatedAt, s.refunds.id)
        .limit(10);
      for (const row of refunds)
        await this.processRefund(row.id).catch(() => undefined);
    } catch {
      /* Durable rows remain available for later verification. */
    } finally {
      this.running = false;
    }
  }
  async processPayout(id: string) {
    if (this.config.get<boolean>("PAYSTACK_TRANSFERS_ENABLED") !== true) return;
    this.gateway.assertConfigured();
    const [initial] = await this.db
      .select()
      .from(s.payouts)
      .where(eq(s.payouts.id, id));
    if (!initial) return;
    const claimed = await this.db.transaction(async (tx) => {
      const [job] = await tx
        .select()
        .from(s.jobs)
        .where(eq(s.jobs.id, initial.jobId))
        .for("update");
      const [payment] = await tx
        .select()
        .from(s.payments)
        .where(eq(s.payments.id, initial.paymentId))
        .for("update");
      const [p] = await tx
        .select()
        .from(s.payouts)
        .where(eq(s.payouts.id, id))
        .for("update");
      const defer = async () => {
        await tx
          .update(s.payouts)
          .set({
            updatedAt: new Date(),
            leaseUntil: new Date(Date.now() + 30000),
          })
          .where(eq(s.payouts.id, id));
        return undefined;
      };
      if (
        !["pending", "processing"].includes(p.status) ||
        (p.leaseUntil && p.leaseUntil > new Date())
      )
        return;
      if (
        job.status !== "completed" ||
        payment.status !== "release_pending" ||
        payment.gateway !== "paystack" ||
        !payment.gatewayReference ||
        p.amountMinor <= 0 ||
        p.amountMinor !== payment.providerAmountMinor ||
        p.currency !== "NGN"
      )
        return defer();
      const [proof] = await tx
        .select()
        .from(s.paymentEvents)
        .where(
          and(
            eq(s.paymentEvents.paymentId, p.paymentId),
            eq(s.paymentEvents.type, "charge.success"),
          ),
        );
      if (!proof) return defer();
      const [provider] = await tx
        .select({
          status: s.providerProfiles.status,
          accountStatus: s.users.accountStatus,
        })
        .from(s.providerProfiles)
        .innerJoin(s.users, eq(s.users.id, s.providerProfiles.userId))
        .where(eq(s.providerProfiles.id, p.providerId));
      if (
        !provider ||
        provider.status === "suspended" ||
        provider.accountStatus !== "active"
      )
        return defer();
      const [blocked] = await tx
        .select()
        .from(s.disputes)
        .where(
          and(
            eq(s.disputes.jobId, p.jobId),
            inArray(s.disputes.status, [
              "open",
              "under_review",
              "resolved_for_client",
            ]),
          ),
        );
      if (blocked) return defer();
      const account = p.accountId
        ? (
            await tx
              .select()
              .from(s.payoutAccounts)
              .where(
                and(
                  eq(s.payoutAccounts.id, p.accountId),
                  eq(s.payoutAccounts.active, true),
                ),
              )
              .for("share")
          )[0]
        : (
            await tx
              .select()
              .from(s.payoutAccounts)
              .where(
                and(
                  eq(s.payoutAccounts.providerId, p.providerId),
                  eq(s.payoutAccounts.active, true),
                ),
              )
              .for("share")
          )[0];
      if (!account) return defer();
      const [out] = await tx
        .update(s.payouts)
        .set({
          status: "processing",
          accountId: account.id,
          recipientCode: p.recipientCode ?? account.recipientCode,
          attemptedAt: p.attemptedAt ?? new Date(),
          leaseUntil: new Date(Date.now() + 60000),
          updatedAt: new Date(),
        })
        .where(eq(s.payouts.id, id))
        .returning();
      return { payout: out, submit: p.attemptedAt === null };
    });
    if (!claimed) return;
    try {
      if (claimed.submit)
        await this.gateway.transfer({
          reference: claimed.payout.reference,
          recipientCode: claimed.payout.recipientCode!,
          amountMinor: claimed.payout.amountMinor,
        });
      await this.applyTransfer(
        id,
        await this.gateway.verifyTransfer(claimed.payout.reference),
      );
    } finally {
      await this.db
        .update(s.payouts)
        .set({ leaseUntil: null })
        .where(eq(s.payouts.id, id));
    }
  }
  async reconcilePayout(id: string) {
    const [payout] = await this.db
      .select()
      .from(s.payouts)
      .where(eq(s.payouts.id, id));
    if (
      !payout?.attemptedAt ||
      !payout.recipientCode ||
      payout.status === "cancelled"
    )
      return {
        outcome: "skipped" as const,
        beforeStatus: payout?.status ?? null,
        afterStatus: payout?.status ?? null,
        gatewayStatus: null,
      };
    const result = await this.gateway.verifyTransfer(payout.reference);
    await this.applyTransfer(id, result);
    const [updated] = await this.db
      .select()
      .from(s.payouts)
      .where(eq(s.payouts.id, id));
    return {
      outcome: "checked" as const,
      beforeStatus: payout.status,
      afterStatus: updated.status,
      gatewayStatus: result.status,
    };
  }
  async reconcileRefund(id: string) {
    const [refund] = await this.db
      .select()
      .from(s.refunds)
      .where(eq(s.refunds.id, id));
    if (!refund?.gatewayId)
      return {
        outcome: "skipped" as const,
        beforeStatus: refund?.status ?? null,
        afterStatus: refund?.status ?? null,
        gatewayStatus: null,
      };
    const result = await this.gateway.verifyRefund(refund.gatewayId);
    await this.applyRefund(id, result);
    const [updated] = await this.db
      .select()
      .from(s.refunds)
      .where(eq(s.refunds.id, id));
    return {
      outcome: "checked" as const,
      beforeStatus: refund.status,
      afterStatus: updated.status,
      gatewayStatus: result.status,
    };
  }
  private async applyTransfer(
    id: string,
    result: Awaited<ReturnType<PaystackGateway["verifyTransfer"]>>,
  ) {
    const [initial] = await this.db
      .select()
      .from(s.payouts)
      .where(eq(s.payouts.id, id));
    if (!initial) return;
    const events: LiveEvent[] = [];
    await this.db.transaction(async (tx) => {
      await tx
        .select()
        .from(s.jobs)
        .where(eq(s.jobs.id, initial.jobId))
        .for("update");
      const [payment] = await tx
        .select()
        .from(s.payments)
        .where(eq(s.payments.id, initial.paymentId))
        .for("update");
      const [p] = await tx
        .select()
        .from(s.payouts)
        .where(eq(s.payouts.id, id))
        .for("update");
      if (
        result.reference !== p.reference ||
        result.amountMinor !== p.amountMinor ||
        result.currency !== p.currency ||
        result.recipientCode !== p.recipientCode
      )
        this.fail(
          "TRANSFER_VERIFICATION_MISMATCH",
          "Transfer does not match the queued payout.",
          422,
        );
      if (
        p.status === "succeeded" &&
        !["success", "reversed"].includes(result.status)
      )
        this.fail(
          "TRANSFER_STATE_CONFLICT",
          "Successful payout has conflicting gateway status.",
        );
      if (p.status === "succeeded" && result.status !== "reversed") return;
      if (p.status === "cancelled") return;
      const status =
        result.status === "success"
          ? "succeeded"
          : ["failed", "reversed"].includes(result.status)
            ? "failed"
            : "processing";
      if (p.status === status && p.gatewayStatus === result.status) return;
      await tx
        .update(s.payouts)
        .set({ status, gatewayStatus: result.status, updatedAt: new Date() })
        .where(eq(s.payouts.id, id));
      if (status === "succeeded")
        await tx
          .update(s.payments)
          .set({ status: "released", updatedAt: new Date() })
          .where(eq(s.payments.id, p.paymentId));
      if (result.status === "reversed")
        await tx
          .update(s.payments)
          .set({ status: "disputed", updatedAt: new Date() })
          .where(eq(s.payments.id, p.paymentId));
      if (status === "succeeded" || status === "failed")
        await this.financeNotice(
          tx,
          payment,
          `payout_${status}`,
          status === "succeeded"
            ? "Provider payout confirmed"
            : "Provider payout requires attention",
          events,
        );
      await tx.insert(s.auditEvents).values({
        action: `payout.${status}`,
        resourceType: "payout",
        resourceId: id,
        details: {
          reference: p.reference,
          gatewayStatus: result.status,
          paymentStatus: payment.status,
        },
      });
    });
    await this.realtime.publish(events);
  }
  async processRefund(id: string) {
    this.gateway.assertConfigured();
    const [initial] = await this.db
      .select()
      .from(s.refunds)
      .where(eq(s.refunds.id, id));
    if (!initial) return;
    const claimed = await this.db.transaction(async (tx) => {
      const [payment] = await tx
        .select()
        .from(s.payments)
        .where(eq(s.payments.id, initial.paymentId));
      const [job] = await tx
        .select()
        .from(s.jobs)
        .where(eq(s.jobs.id, payment.jobId))
        .for("update");
      const [currentPayment] = await tx
        .select()
        .from(s.payments)
        .where(eq(s.payments.id, payment.id))
        .for("update");
      const [r] = await tx
        .select()
        .from(s.refunds)
        .where(eq(s.refunds.id, id))
        .for("update");
      if (
        !["pending", "processing"].includes(r.status) ||
        (r.leaseUntil && r.leaseUntil > new Date())
      )
        return;
      const [proof] = await tx
        .select()
        .from(s.paymentEvents)
        .where(
          and(
            eq(s.paymentEvents.paymentId, r.paymentId),
            eq(s.paymentEvents.type, "charge.success"),
          ),
        );
      if (
        !proof ||
        job.status !== "cancelled" ||
        !["funded", "held"].includes(currentPayment.status) ||
        currentPayment.gateway !== "paystack" ||
        !currentPayment.gatewayReference ||
        r.amountMinor !== currentPayment.amountMinor ||
        r.currency !== "NGN"
      )
        return;
      if (r.attemptedAt && !r.gatewayId) {
        await tx
          .update(s.refunds)
          .set({
            updatedAt: new Date(),
            leaseUntil: new Date(Date.now() + 300000),
          })
          .where(eq(s.refunds.id, id));
        return;
      }
      const [out] = await tx
        .update(s.refunds)
        .set({
          status: "processing",
          attemptedAt: r.attemptedAt ?? new Date(),
          leaseUntil: new Date(Date.now() + 60000),
          updatedAt: new Date(),
        })
        .where(eq(s.refunds.id, id))
        .returning();
      return {
        refund: out,
        payment: currentPayment,
        submit: r.attemptedAt === null,
      };
    });
    if (!claimed) return;
    try {
      let gatewayId = claimed.refund.gatewayId;
      if (claimed.submit) {
        const created = await this.gateway.createRefund({
          reference: claimed.payment.gatewayReference!,
          amountMinor: claimed.refund.amountMinor,
          refundId: id,
        });
        gatewayId = created.id;
        await this.db
          .update(s.refunds)
          .set({ gatewayId })
          .where(eq(s.refunds.id, id));
      }
      await this.applyRefund(id, await this.gateway.verifyRefund(gatewayId!));
    } finally {
      await this.db
        .update(s.refunds)
        .set({ leaseUntil: null })
        .where(eq(s.refunds.id, id));
    }
  }
  private async applyRefund(
    id: string,
    result: Awaited<ReturnType<PaystackGateway["verifyRefund"]>>,
  ) {
    const [initial] = await this.db
      .select()
      .from(s.refunds)
      .where(eq(s.refunds.id, id));
    if (!initial) return;
    const events: LiveEvent[] = [];
    await this.db.transaction(async (tx) => {
      const [payment] = await tx
        .select()
        .from(s.payments)
        .where(eq(s.payments.id, initial.paymentId));
      await tx
        .select()
        .from(s.jobs)
        .where(eq(s.jobs.id, payment.jobId))
        .for("update");
      await tx
        .select()
        .from(s.payments)
        .where(eq(s.payments.id, payment.id))
        .for("update");
      const [r] = await tx
        .select()
        .from(s.refunds)
        .where(eq(s.refunds.id, id))
        .for("update");
      const [proof] = await tx
        .select()
        .from(s.paymentEvents)
        .where(
          and(
            eq(s.paymentEvents.paymentId, r.paymentId),
            eq(s.paymentEvents.type, "charge.success"),
          ),
        );
      if (
        !proof ||
        proof.gatewayEventId !==
          `paystack.charge.success.${result.transactionId}` ||
        result.amountMinor !== r.amountMinor ||
        result.currency !== r.currency ||
        result.merchantNote !== `konet-refund:${r.id}` ||
        (r.gatewayId && r.gatewayId !== result.id)
      )
        this.fail(
          "REFUND_VERIFICATION_MISMATCH",
          "Refund does not match the authorization.",
          422,
        );
      if (r.status === "succeeded" && result.status !== "processed")
        this.fail(
          "REFUND_STATE_CONFLICT",
          "Successful refund has conflicting gateway status.",
        );
      if (r.status === "succeeded") return;
      const status =
        result.status === "processed"
          ? "succeeded"
          : result.status === "failed"
            ? "failed"
            : "processing";
      if (r.status === status && r.gatewayStatus === result.status) return;
      await tx
        .update(s.refunds)
        .set({
          status,
          gatewayId: result.id,
          gatewayStatus: result.status,
          updatedAt: new Date(),
        })
        .where(eq(s.refunds.id, id));
      if (status === "succeeded")
        await tx
          .update(s.payments)
          .set({ status: "refunded", updatedAt: new Date() })
          .where(eq(s.payments.id, r.paymentId));
      if (status === "succeeded" || status === "failed")
        await this.financeNotice(
          tx,
          payment,
          `refund_${status}`,
          status === "succeeded"
            ? "Client refund confirmed"
            : "Client refund requires attention",
          events,
        );
      await tx.insert(s.auditEvents).values({
        action: `refund.${status}`,
        resourceType: "refund",
        resourceId: id,
        details: { gatewayId: result.id, paymentId: r.paymentId },
      });
    });
    await this.realtime.publish(events);
  }
  async webhook(kind: "transfer" | "refund", reference: string) {
    if (kind === "transfer") {
      const [p] = await this.db
        .select()
        .from(s.payouts)
        .where(eq(s.payouts.reference, reference));
      if (p)
        await this.applyTransfer(
          p.id,
          await this.gateway.verifyTransfer(reference),
        );
    } else {
      const result = await this.gateway.verifyRefund(reference);
      const marker = /^konet-refund:([0-9a-f-]{36})$/i.exec(
        result.merchantNote,
      );
      if (marker) await this.applyRefund(marker[1], result);
    }
    return { message: "Settlement event verified." };
  }
  async adminPayouts(q: ListQuery) {
    if (
      q.status &&
      !["pending", "processing", "succeeded", "failed", "cancelled"].includes(
        q.status,
      )
    )
      this.fail("INVALID_STATUS", "Invalid payout status.", 400);
    return (
      await this.db
        .select()
        .from(s.payouts)
        .where(q.status ? eq(s.payouts.status, q.status) : undefined)
        .orderBy(desc(s.payouts.createdAt), s.payouts.id)
        .limit(q.limit ?? 20)
        .offset(q.offset ?? 0)
    ).map((p) => this.payoutView(p));
  }
  async adminPayout(id: string) {
    const [p] = await this.db
      .select()
      .from(s.payouts)
      .where(eq(s.payouts.id, id));
    if (!p) this.fail("PAYOUT_NOT_FOUND", "Payout not found.", 404);
    return this.payoutView(p);
  }
}
