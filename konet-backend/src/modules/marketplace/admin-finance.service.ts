import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, sql } from "drizzle-orm";
import { DATABASE, Database } from "../../database/database.module";
import * as s from "../../database/schema";
import { DomainError } from "../../common/errors/domain.error";
import { ListQuery } from "../contracts/contract.dto";
@Injectable()
export class AdminFinanceService {
  constructor(@Inject(DATABASE) private db: Database) {}
  async list(query: ListQuery) {
    if (
      query.status &&
      !s.paymentStatus.enumValues.includes(
        query.status as (typeof s.paymentStatus.enumValues)[number],
      )
    )
      throw new DomainError(
        "INVALID_STATUS",
        "Choose a valid payment status.",
        400,
      );
    return this.db
      .select()
      .from(s.payments)
      .where(
        query.status
          ? eq(
              s.payments.status,
              query.status as (typeof s.paymentStatus.enumValues)[number],
            )
          : undefined,
      )
      .orderBy(desc(s.payments.createdAt), desc(s.payments.id))
      .limit(query.limit ?? 20)
      .offset(query.offset ?? 0);
  }
  async one(id: string) {
    const [payment] = await this.db
      .select()
      .from(s.payments)
      .where(eq(s.payments.id, id));
    if (!payment)
      throw new DomainError("PAYMENT_NOT_FOUND", "Payment not found.", 404);
    return payment;
  }
  async report() {
    return this.db.transaction(
      async (tx) => {
        const count = async (
          table:
            | typeof s.users
            | typeof s.providerProfiles
            | typeof s.jobs
            | typeof s.disputes,
        ) => {
          const [row] = await tx
            .select({ value: sql<number>`count(*)::integer` })
            .from(table);
          return row.value;
        };
        const users = await count(s.users),
          providers = await count(s.providerProfiles),
          jobs = await count(s.jobs),
          disputes = await count(s.disputes);
        const [money] = await tx
          .select({
            collectedMinor: sql<number>`coalesce(sum(${s.payments.amountMinor}),0)::double precision`,
            earnedCommissionMinor: sql<number>`coalesce(sum(case when ${s.payments.status}='released' and exists (select 1 from payouts p where p.payment_id=${s.payments.id} and p.status='succeeded' and p.gateway_status='success') then ${s.payments.platformFeeMinor} else 0 end),0)::double precision`,
            reservedClientFundsMinor: sql<number>`coalesce(sum(case when ${s.payments.status} in ('funded','held','release_pending','disputed') then ${s.payments.amountMinor} else 0 end),0)::double precision`,
            knownProcessingFeesMinor: sql<number>`coalesce(sum(${s.payments.gatewayFeeMinor}),0)::double precision`,
            missingProcessingFeeCount: sql<number>`count(*) filter (where ${s.payments.gatewayFeeMinor} is null)::integer`,
          })
          .from(s.payments)
          .where(
            sql`exists (select 1 from payment_events e where e.payment_id=${s.payments.id} and e.type='charge.success')`,
          );
        const [paid] = await tx
          .select({
            value: sql<number>`coalesce(sum(${s.payouts.amountMinor}),0)::double precision`,
          })
          .from(s.payouts)
          .where(
            and(
              eq(s.payouts.status, "succeeded"),
              eq(s.payouts.gatewayStatus, "success"),
            ),
          );
        const [refunded] = await tx
          .select({
            value: sql<number>`coalesce(sum(${s.refunds.amountMinor}),0)::double precision`,
          })
          .from(s.refunds)
          .where(
            and(
              eq(s.refunds.status, "succeeded"),
              eq(s.refunds.gatewayStatus, "processed"),
            ),
          );
        const amounts = [
          money.collectedMinor,
          money.earnedCommissionMinor,
          money.reservedClientFundsMinor,
          money.knownProcessingFeesMinor,
          paid.value,
          refunded.value,
        ];
        if (amounts.some((value) => !Number.isSafeInteger(value)))
          throw new DomainError(
            "REPORT_AMOUNT_OVERFLOW",
            "Report totals exceed supported integer precision.",
            503,
          );
        return {
          users,
          providers,
          jobs,
          disputes,
          ...money,
          paidOutMinor: paid.value,
          refundedMinor: refunded.value,
          currency: "NGN",
          asOf: new Date(),
          basis: "verified_ledger",
          note: "Ledger totals are not bank balance or profit. Reserved client funds are not available business revenue. Transfer, custody and operating costs are not included.",
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
}
