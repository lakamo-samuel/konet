import { SettlementService } from "./settlement.service";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, desc, eq, or } from "drizzle-orm";
import { createHash } from "node:crypto";
import { DATABASE, Database } from "../../database/database.module";
import * as s from "../../database/schema";
import { DomainError } from "../../common/errors/domain.error";
import { PaystackGateway } from "../../infrastructure/payments/paystack.gateway";
import { ListQuery } from "../contracts/contract.dto";
import { VerifiedPayment } from "../../infrastructure/payments/payment-gateway";
@Injectable()
export class PaymentService {
  constructor(
    @Inject(DATABASE) private db: Database,
    private gateway: PaystackGateway,
    private config: ConfigService,
    private settlements: SettlementService,
  ) {}
  private fail(code: string, message: string, status = 409): never {
    throw new DomainError(code, message, status);
  }
  async owned(userId: string, jobId: string) {
    const [row] = await this.db
      .select({
        payment: s.payments,
        job: s.jobs,
        providerUserId: s.providerProfiles.userId,
      })
      .from(s.payments)
      .innerJoin(s.jobs, eq(s.jobs.id, s.payments.jobId))
      .innerJoin(
        s.providerProfiles,
        eq(s.providerProfiles.id, s.jobs.providerId),
      )
      .where(
        and(
          eq(s.jobs.id, jobId),
          or(
            eq(s.jobs.clientId, userId),
            eq(s.providerProfiles.userId, userId),
          ),
        ),
      )
      .limit(1);
    if (!row) this.fail("PAYMENT_NOT_FOUND", "Payment not found.", 404);
    return row;
  }
  async get(userId: string, id: string) {
    return (await this.owned(userId, id)).payment;
  }
  async list(userId: string, q: ListQuery) {
    const statuses = [
      "pending",
      "processing",
      "funded",
      "held",
      "release_pending",
      "released",
      "failed",
      "refunded",
      "disputed",
    ];
    if (q.status && !statuses.includes(q.status))
      this.fail("INVALID_STATUS", "Invalid payment status.", 400);
    const [p] = await this.db
      .select()
      .from(s.providerProfiles)
      .where(eq(s.providerProfiles.userId, userId));
    return this.db
      .select()
      .from(s.payments)
      .where(
        and(
          p
            ? or(
                eq(s.payments.payerId, userId),
                eq(s.payments.providerId, p.id),
              )
            : eq(s.payments.payerId, userId),
          q.status
            ? eq(
                s.payments.status,
                q.status as typeof s.payments.$inferSelect.status,
              )
            : undefined,
        ),
      )
      .orderBy(desc(s.payments.createdAt), s.payments.id)
      .limit(q.limit ?? 20)
      .offset(q.offset ?? 0);
  }
  async initialize(userId: string, jobId: string) {
    const owned = await this.owned(userId, jobId);
    if (owned.job.clientId !== userId)
      this.fail(
        "PAYMENT_FORBIDDEN",
        "Only the client initializes payment.",
        403,
      );
    this.gateway.assertConfigured();
    const prepared = await this.db.transaction(async (tx) => {
      const [job] = await tx
        .select()
        .from(s.jobs)
        .where(eq(s.jobs.id, jobId))
        .for("update");
      const [payment] = await tx
        .select()
        .from(s.payments)
        .where(eq(s.payments.jobId, jobId))
        .for("update");
      if (
        job.status !== "awaiting_payment" ||
        !["pending", "processing", "failed"].includes(payment.status)
      )
        this.fail("PAYMENT_NOT_PAYABLE", "This job cannot start checkout.");
      if (
        payment.amountMinor !== job.agreedAmountMinor ||
        payment.currency !== "NGN" ||
        payment.currency !== job.currency ||
        payment.amountMinor <= 0
      )
        this.fail(
          "PAYMENT_AMOUNT_MISMATCH",
          "Payment must match the agreed NGN amount.",
        );
      const [cached] = await tx
        .select()
        .from(s.paymentCheckouts)
        .where(eq(s.paymentCheckouts.paymentId, payment.id));
      if (cached?.checkoutUrl) return { cached, payment };
      if (cached?.leaseUntil && cached.leaseUntil > new Date())
        this.fail(
          "CHECKOUT_IN_PROGRESS",
          "Checkout is being initialized. Retry shortly.",
        );
      const reference = cached?.reference ?? `konet-${payment.id}`;
      const leaseUntil = new Date(Date.now() + 60000);
      await tx
        .insert(s.paymentCheckouts)
        .values({ paymentId: payment.id, reference, leaseUntil })
        .onConflictDoUpdate({
          target: s.paymentCheckouts.paymentId,
          set: { leaseUntil, updatedAt: new Date() },
        });
      await tx
        .update(s.payments)
        .set({
          gateway: "paystack",
          gatewayReference: reference,
          status: "processing",
          updatedAt: new Date(),
        })
        .where(eq(s.payments.id, payment.id));
      return { payment, reference };
    });
    if (prepared.cached)
      return {
        paymentId: prepared.payment.id,
        reference: prepared.cached.reference,
        checkoutUrl: prepared.cached.checkoutUrl,
      };
    const [user] = await this.db
      .select()
      .from(s.users)
      .where(eq(s.users.id, userId));
    const callbackUrl =
      this.config.get<string>("PAYMENT_CALLBACK_URL") ||
      new URL(
        "/payment-result",
        this.config.getOrThrow<string>("FRONTEND_URL"),
      ).toString();
    try {
      const checkout = await this.gateway.initialize({
        paymentId: prepared.payment.id,
        reference: prepared.reference!,
        email: user.email,
        amountMinor: prepared.payment.amountMinor,
        currency: prepared.payment.currency,
        callbackUrl,
      });
      await this.db
        .update(s.paymentCheckouts)
        .set({
          checkoutUrl: checkout.checkoutUrl,
          leaseUntil: null,
          updatedAt: new Date(),
        })
        .where(eq(s.paymentCheckouts.paymentId, prepared.payment.id));
      return { paymentId: prepared.payment.id, ...checkout };
    } catch (error) {
      // Reference remains durable after ambiguous provider failures. Never issue a second charge reference.
      await this.db
        .update(s.paymentCheckouts)
        .set({ leaseUntil: null, updatedAt: new Date() })
        .where(eq(s.paymentCheckouts.paymentId, prepared.payment.id));
      throw error;
    }
  }
  async verify(userId: string, jobId: string) {
    const { payment } = await this.owned(userId, jobId);
    if (payment.gateway !== "paystack" || !payment.gatewayReference)
      this.fail("CHECKOUT_REQUIRED", "Start checkout first.");
    const result = await this.gateway.verify(payment.gatewayReference);
    return this.apply(
      payment.id,
      result,
      createHash("sha256").update(JSON.stringify(result)).digest("hex"),
    );
  }
  private async apply(
    paymentId: string,
    result: VerifiedPayment,
    payloadHash: string,
  ) {
    return this.db.transaction(async (tx) => {
      const [initial] = await tx
        .select()
        .from(s.payments)
        .where(eq(s.payments.id, paymentId));
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
      const [payer] = await tx
        .select()
        .from(s.users)
        .where(eq(s.users.id, payment.payerId));
      if (
        result.reference !== payment.gatewayReference ||
        result.amountMinor !== payment.amountMinor ||
        result.currency !== payment.currency ||
        result.paymentId !== payment.id ||
        result.email.toLowerCase() !== payer.email.toLowerCase()
      )
        this.fail(
          "PAYMENT_VERIFICATION_MISMATCH",
          "Verified transaction does not match this payment.",
          422,
        );
      if (result.status !== "success") return payment;
      const eventId = `paystack.charge.success.${result.transactionId}`;
      const [existing] = await tx
        .select()
        .from(s.paymentEvents)
        .where(eq(s.paymentEvents.gatewayEventId, eventId));
      if (existing) {
        if (existing.paymentId !== payment.id)
          this.fail(
            "PAYMENT_EVENT_CONFLICT",
            "Transaction belongs to another payment.",
          );
        return payment;
      }
      if (
        !["pending", "processing", "failed"].includes(payment.status) ||
        job.status !== "awaiting_payment"
      )
        this.fail(
          "PAYMENT_STATE_CONFLICT",
          "Payment requires reconciliation before changing this job.",
        );
      await tx.insert(s.paymentEvents).values({
        paymentId,
        gatewayEventId: eventId,
        type: "charge.success",
        payloadHash,
      });
      const [out] = await tx
        .update(s.payments)
        .set({ status: "funded", updatedAt: new Date() })
        .where(eq(s.payments.id, payment.id))
        .returning();
      await tx
        .update(s.jobs)
        .set({
          status: "scheduled",
          scheduledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(s.jobs.id, job.id));
      await tx.insert(s.auditEvents).values({
        action: "payment.funded",
        resourceType: "payment",
        resourceId: payment.id,
        details: {
          reference: result.reference,
          transactionId: result.transactionId,
          jobId: job.id,
        },
      });
      const [provider] = await tx
        .select()
        .from(s.providerProfiles)
        .where(eq(s.providerProfiles.id, job.providerId));
      await tx.insert(s.notifications).values(
        [job.clientId, provider.userId].map((userId) => ({
          userId,
          type: "payment_funded",
          title: "Job payment confirmed",
          body: "Payment is confirmed and work can begin.",
          resourceType: "job",
          resourceId: job.id,
        })),
      );
      return out;
    });
  }
  async webhook(gateway: string, signature: string, raw?: Buffer) {
    if (gateway !== "paystack")
      this.fail("GATEWAY_NOT_FOUND", "Unknown payment gateway.", 404);
    if (!raw)
      this.fail("RAW_BODY_REQUIRED", "Raw webhook body is required.", 400);
    const event = await this.gateway.verifyWebhook(signature, raw);
    if (event.status === "settlement" && event.kind)
      return this.settlements.webhook(event.kind, event.reference);
    if (event.status === "ignored") return { message: "Event ignored." };
    const [payment] = await this.db
      .select()
      .from(s.payments)
      .where(
        and(
          eq(s.payments.gateway, "paystack"),
          eq(s.payments.gatewayReference, event.reference),
        ),
      );
    if (!payment) return { message: "Unrelated payment ignored." };
    const [existing] = await this.db
      .select()
      .from(s.paymentEvents)
      .where(eq(s.paymentEvents.gatewayEventId, event.eventId));
    if (existing?.paymentId === payment.id)
      return { message: "Payment event already processed." };
    const result = await this.gateway.verify(event.reference);
    if (
      `paystack.charge.success.${result.transactionId}` !== event.eventId ||
      result.status !== "success"
    )
      this.fail(
        "PAYMENT_VERIFICATION_MISMATCH",
        "Webhook does not match verified transaction.",
        422,
      );
    await this.apply(
      payment.id,
      result,
      createHash("sha256").update(raw).digest("hex"),
    );
    return { message: "Payment event processed." };
  }
}
