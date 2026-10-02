import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "../../common/guards/auth.guard";
import { DomainError } from "../../common/errors/domain.error";
import * as Dto from "./contract.dto";

function unavailable(operation: string): never {
  throw new DomainError(
    "ENDPOINT_NOT_IMPLEMENTED",
    `${operation} is contract-only; backend implementation is pending.`,
    501,
  );
}

@ApiTags("public contracts")
@Controller({ version: "1" })
export class PublicContractsController {
  @Post("webhooks/payments/:gateway")
  @HttpCode(200)
  @ApiOperation({ summary: "Receive signed payment provider event" })
  postWebhooksPaymentsGateway(@Param("gateway") _gateway: string): never {
    return unavailable("Receive signed payment provider event");
  }

  @Post("contact")
  @HttpCode(202)
  @ApiOperation({ summary: "Submit support contact message" })
  postContact(@Body() _body: Dto.ContactInput): never {
    return unavailable("Submit support contact message");
  }
}

@ApiTags("member contracts")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ version: "1" })
export class MemberContractsController {
  @Patch("me/profile")
  @HttpCode(200)
  @ApiOperation({ summary: "Update current account profile" })
  patchMeProfile(@Body() _body: Dto.ProfileInput): never {
    return unavailable("Update current account profile");
  }

  @Post("me/email-change")
  @HttpCode(202)
  @ApiOperation({ summary: "Request account email change" })
  postMeEmailChange(@Body() _body: Dto.EmailChangeInput): never {
    return unavailable("Request account email change");
  }

  @Post("me/email-change/confirm")
  @HttpCode(200)
  @ApiOperation({ summary: "Confirm new account email" })
  postMeEmailChangeConfirm(@Body() _body: Dto.ConfirmChallengeInput): never {
    return unavailable("Confirm new account email");
  }

  @Delete("me/account")
  @HttpCode(204)
  @ApiOperation({ summary: "Deactivate account" })
  deleteMeAccount(@Body() _body: Dto.ReasonInput): never {
    return unavailable("Deactivate account");
  }

  @Get("jobs/:id/review")
  @HttpCode(200)
  @ApiOperation({ summary: "Read review for participant job" })
  getJobsIdReview(@Param("id", new ParseUUIDPipe()) _id: string): never {
    return unavailable("Read review for participant job");
  }

  @Get("disputes")
  @HttpCode(200)
  @ApiOperation({ summary: "List own disputes" })
  getDisputes(@Query() _query: Dto.ListQuery): never {
    return unavailable("List own disputes");
  }

  @Get("disputes/:id")
  @HttpCode(200)
  @ApiOperation({ summary: "Read participant dispute" })
  getDisputesId(@Param("id", new ParseUUIDPipe()) _id: string): never {
    return unavailable("Read participant dispute");
  }

  @Get("disputes/:id/decisions")
  @HttpCode(200)
  @ApiOperation({ summary: "Read dispute decision history" })
  getDisputesIdDecisions(@Param("id", new ParseUUIDPipe()) _id: string): never {
    return unavailable("Read dispute decision history");
  }

  @Post("jobs/:jobId/payment/verify")
  @HttpCode(200)
  @ApiOperation({ summary: "Verify payment with provider server-side" })
  postJobsJobIdPaymentVerify(
    @Param("jobId", new ParseUUIDPipe()) _jobId: string,
  ): never {
    return unavailable("Verify payment with provider server-side");
  }

  @Get("jobs/:jobId/payout")
  @HttpCode(200)
  @ApiOperation({ summary: "Read participant payout status" })
  getJobsJobIdPayout(
    @Param("jobId", new ParseUUIDPipe()) _jobId: string,
  ): never {
    return unavailable("Read participant payout status");
  }

  @Get("jobs/:jobId/refunds")
  @HttpCode(200)
  @ApiOperation({ summary: "Read participant refunds" })
  getJobsJobIdRefunds(
    @Param("jobId", new ParseUUIDPipe()) _jobId: string,
  ): never {
    return unavailable("Read participant refunds");
  }

  @Get("me/payments")
  @HttpCode(200)
  @ApiOperation({ summary: "List own payments" })
  getMePayments(@Query() _query: Dto.ListQuery): never {
    return unavailable("List own payments");
  }

  @Get("me/earnings")
  @HttpCode(200)
  @ApiOperation({ summary: "Read provider earnings summary" })
  getMeEarnings(): never {
    return unavailable("Read provider earnings summary");
  }

  @Get("me/payouts")
  @HttpCode(200)
  @ApiOperation({ summary: "List own provider payouts" })
  getMePayouts(@Query() _query: Dto.ListQuery): never {
    return unavailable("List own provider payouts");
  }

  @Get("me/payout-accounts")
  @HttpCode(200)
  @ApiOperation({ summary: "List own payout accounts" })
  getMePayoutAccounts(): never {
    return unavailable("List own payout accounts");
  }

  @Post("me/payout-accounts")
  @HttpCode(201)
  @ApiOperation({ summary: "Register provider payout recipient" })
  postMePayoutAccounts(@Body() _body: Dto.PayoutAccountInput): never {
    return unavailable("Register provider payout recipient");
  }

  @Delete("me/payout-accounts/:id")
  @HttpCode(204)
  @ApiOperation({ summary: "Remove payout account" })
  deleteMePayoutAccountsId(
    @Param("id", new ParseUUIDPipe()) _id: string,
  ): never {
    return unavailable("Remove payout account");
  }
}

@ApiTags("admin contracts")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ version: "1" })
export class AdminContractsController {
  @Get("admin/disputes")
  @HttpCode(200)
  @ApiOperation({ summary: "List disputes for authorized staff" })
  getAdminDisputes(@Query() _query: Dto.ListQuery): never {
    return unavailable("List disputes for authorized staff");
  }

  @Get("admin/disputes/:id")
  @HttpCode(200)
  @ApiOperation({ summary: "Read disputes for authorized staff" })
  getAdminDisputesId(@Param("id", new ParseUUIDPipe()) _id: string): never {
    return unavailable("Read disputes for authorized staff");
  }

  @Get("admin/payments")
  @HttpCode(200)
  @ApiOperation({ summary: "List payments for authorized staff" })
  getAdminPayments(@Query() _query: Dto.ListQuery): never {
    return unavailable("List payments for authorized staff");
  }

  @Get("admin/payments/:id")
  @HttpCode(200)
  @ApiOperation({ summary: "Read payments for authorized staff" })
  getAdminPaymentsId(@Param("id", new ParseUUIDPipe()) _id: string): never {
    return unavailable("Read payments for authorized staff");
  }

  @Get("admin/payouts")
  @HttpCode(200)
  @ApiOperation({ summary: "List payouts for authorized staff" })
  getAdminPayouts(@Query() _query: Dto.ListQuery): never {
    return unavailable("List payouts for authorized staff");
  }

  @Get("admin/payouts/:id")
  @HttpCode(200)
  @ApiOperation({ summary: "Read payouts for authorized staff" })
  getAdminPayoutsId(@Param("id", new ParseUUIDPipe()) _id: string): never {
    return unavailable("Read payouts for authorized staff");
  }

  @Patch("admin/users/:id/status")
  @HttpCode(200)
  @ApiOperation({ summary: "Set account status with audit reason" })
  patchAdminUsersIdStatus(
    @Param("id", new ParseUUIDPipe()) _id: string,
    @Body() _body: Dto.AccountStatusInput,
  ): never {
    return unavailable("Set account status with audit reason");
  }

  @Post("admin/disputes/:id/decision")
  @HttpCode(201)
  @ApiOperation({ summary: "Resolve dispute and authorize payout or refund" })
  postAdminDisputesIdDecision(
    @Param("id", new ParseUUIDPipe()) _id: string,
    @Body() _body: Dto.DisputeDecisionInput,
  ): never {
    return unavailable("Resolve dispute and authorize payout or refund");
  }

  @Post("admin/payments/:id/refunds")
  @HttpCode(202)
  @ApiOperation({ summary: "Initiate authorized refund" })
  postAdminPaymentsIdRefunds(
    @Param("id", new ParseUUIDPipe()) _id: string,
    @Body() _body: Dto.RefundInput,
  ): never {
    return unavailable("Initiate authorized refund");
  }

  @Post("admin/payouts/:id/retry")
  @HttpCode(202)
  @ApiOperation({ summary: "Retry failed payout without duplicate transfer" })
  postAdminPayoutsIdRetry(
    @Param("id", new ParseUUIDPipe()) _id: string,
    @Body() _body: Dto.ReasonInput,
  ): never {
    return unavailable("Retry failed payout without duplicate transfer");
  }

  @Post("admin/reconciliations")
  @HttpCode(202)
  @ApiOperation({ summary: "Queue payment reconciliation" })
  postAdminReconciliations(@Body() _body: Dto.ReconciliationInput): never {
    return unavailable("Queue payment reconciliation");
  }

  @Get("admin/reconciliations")
  @HttpCode(200)
  @ApiOperation({ summary: "List reconciliation runs" })
  getAdminReconciliations(@Query() _query: Dto.ListQuery): never {
    return unavailable("List reconciliation runs");
  }

  @Get("admin/reconciliations/:id")
  @HttpCode(200)
  @ApiOperation({ summary: "Read reconciliation result" })
  getAdminReconciliationsId(
    @Param("id", new ParseUUIDPipe()) _id: string,
  ): never {
    return unavailable("Read reconciliation result");
  }

  @Get("admin/reports")
  @HttpCode(200)
  @ApiOperation({ summary: "Read operational and financial report" })
  getAdminReports(): never {
    return unavailable("Read operational and financial report");
  }
}
