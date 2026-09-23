import {
  Controller,
  Get,
  Inject,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { and, eq, or } from "drizzle-orm";
import {
  AuthUser,
  CurrentUser,
} from "../../common/decorators/current-user.decorator";
import { DomainError } from "../../common/errors/domain.error";
import { AuthGuard } from "../../common/guards/auth.guard";
import { DATABASE, Database } from "../../database/database.module";
import { jobs, payments, providerProfiles } from "../../database/schema";
import {
  PAYMENT_GATEWAY,
  PaymentGateway,
} from "../../infrastructure/payments/payment-gateway";
@ApiTags("payments")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ version: "1" })
export class PaymentsController {
  constructor(
    @Inject(DATABASE) private db: Database,
    @Inject(PAYMENT_GATEWAY) private gateway: PaymentGateway,
  ) {}
  private async owned(userId: string, jobId: string) {
    const [p] = await this.db
      .select({ id: providerProfiles.id })
      .from(providerProfiles)
      .where(eq(providerProfiles.userId, userId))
      .limit(1);
    const [row] = await this.db
      .select({ payment: payments, job: jobs })
      .from(payments)
      .innerJoin(jobs, eq(payments.jobId, jobs.id))
      .where(
        and(
          eq(jobs.id, jobId),
          p
            ? or(eq(jobs.clientId, userId), eq(jobs.providerId, p.id))
            : eq(jobs.clientId, userId),
        ),
      )
      .limit(1);
    if (!row)
      throw new DomainError("PAYMENT_NOT_FOUND", "Payment not found.", 404);
    return row;
  }
  @Get("jobs/:jobId/payment") async get(
    @CurrentUser() u: AuthUser,
    @Param("jobId") id: string,
  ) {
    return (await this.owned(u.userId, id)).payment;
  }
  @Post("jobs/:jobId/payments") async initialize(
    @CurrentUser() u: AuthUser,
    @Param("jobId") id: string,
  ) {
    const row = await this.owned(u.userId, id);
    if (row.job.clientId !== u.userId)
      throw new DomainError(
        "PAYMENT_FORBIDDEN",
        "Only the client can initialize payment.",
        403,
      );
    if (row.payment.status !== "pending" && row.payment.status !== "failed")
      throw new DomainError(
        "PAYMENT_ALREADY_INITIALIZED",
        "Payment is already being processed.",
        409,
      );
    return this.gateway.initialize({
      paymentId: row.payment.id,
      amountMinor: row.payment.amountMinor,
      currency: row.payment.currency,
      callbackUrl: "",
    });
  }
}
