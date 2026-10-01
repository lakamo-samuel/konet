import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseEnumPipe,
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
  @Get("providers/:id/services")
  @HttpCode(200)
  @ApiOperation({ summary: "List public provider services" })
  getProvidersIdServices(@Param("id", new ParseUUIDPipe()) _id: string): never {
    return unavailable("List public provider services");
  }

  @Get("providers/:id/portfolio")
  @HttpCode(200)
  @ApiOperation({ summary: "List public portfolio" })
  getProvidersIdPortfolio(
    @Param("id", new ParseUUIDPipe()) _id: string,
  ): never {
    return unavailable("List public portfolio");
  }

  @Get("providers/:id/reviews")
  @HttpCode(200)
  @ApiOperation({ summary: "List provider reviews" })
  getProvidersIdReviews(
    @Param("id", new ParseUUIDPipe()) _id: string,
    @Query() _query: Dto.ListQuery,
  ): never {
    return unavailable("List provider reviews");
  }

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

  @Get("me/provider-profile")
  @HttpCode(200)
  @ApiOperation({ summary: "Read own provider profile" })
  getMeProviderProfile(): never {
    return unavailable("Read own provider profile");
  }

  @Patch("me/provider-profile")
  @HttpCode(200)
  @ApiOperation({ summary: "Update own provider profile" })
  patchMeProviderProfile(@Body() _body: Dto.ProviderUpdateInput): never {
    return unavailable("Update own provider profile");
  }

  @Get("me/provider-verifications")
  @HttpCode(200)
  @ApiOperation({ summary: "Read provider verification dimensions" })
  getMeProviderVerifications(): never {
    return unavailable("Read provider verification dimensions");
  }

  @Post("me/provider-verifications")
  @HttpCode(201)
  @ApiOperation({ summary: "Submit private provider evidence" })
  postMeProviderVerifications(@Body() _body: Dto.ProviderEvidenceInput): never {
    return unavailable("Submit private provider evidence");
  }

  @Post("me/provider-profile/submit")
  @HttpCode(202)
  @ApiOperation({ summary: "Submit provider profile for staff approval" })
  postMeProviderProfileSubmit(): never {
    return unavailable("Submit provider profile for staff approval");
  }

  @Post("me/provider-profile/publish")
  @HttpCode(200)
  @ApiOperation({ summary: "Publish approved provider profile" })
  postMeProviderProfilePublish(): never {
    return unavailable("Publish approved provider profile");
  }

  @Patch("me/provider-profile/status")
  @HttpCode(200)
  @ApiOperation({ summary: "Pause or reactivate approved provider" })
  patchMeProviderProfileStatus(@Body() _body: Dto.ProviderStatusInput): never {
    return unavailable("Pause or reactivate approved provider");
  }

  @Get("me/provider-onboarding")
  @HttpCode(200)
  @ApiOperation({ summary: "Read complete onboarding draft" })
  getMeProviderOnboarding(): never {
    return unavailable("Read complete onboarding draft");
  }

  @Patch("me/provider-onboarding/steps/:step")
  @HttpCode(200)
  @ApiOperation({ summary: "Save onboarding step draft" })
  patchMeProviderOnboardingStepsStep(
    @Param(
      "step",
      new ParseEnumPipe({
        profile: "profile",
        services: "services",
        portfolio: "portfolio",
        evidence: "evidence",
        preview: "preview",
      }),
    )
    _step: string,
    @Body() _body: Dto.OnboardingStepInput,
  ): never {
    return unavailable("Save onboarding step draft");
  }

  @Get("me/portfolio")
  @HttpCode(200)
  @ApiOperation({ summary: "List own portfolio" })
  getMePortfolio(): never {
    return unavailable("List own portfolio");
  }

  @Post("me/portfolio")
  @HttpCode(201)
  @ApiOperation({ summary: "Create portfolio item" })
  postMePortfolio(@Body() _body: Dto.PortfolioInput): never {
    return unavailable("Create portfolio item");
  }

  @Patch("me/portfolio/:id")
  @HttpCode(200)
  @ApiOperation({ summary: "Update portfolio item" })
  patchMePortfolioId(
    @Param("id", new ParseUUIDPipe()) _id: string,
    @Body() _body: Dto.PortfolioUpdateInput,
  ): never {
    return unavailable("Update portfolio item");
  }

  @Delete("me/portfolio/:id")
  @HttpCode(204)
  @ApiOperation({ summary: "Delete portfolio item" })
  deleteMePortfolioId(@Param("id", new ParseUUIDPipe()) _id: string): never {
    return unavailable("Delete portfolio item");
  }

  @Get("requests/:id")
  @HttpCode(200)
  @ApiOperation({ summary: "Read participant request" })
  getRequestsId(@Param("id", new ParseUUIDPipe()) _id: string): never {
    return unavailable("Read participant request");
  }

  @Post("requests/:id/withdraw")
  @HttpCode(200)
  @ApiOperation({ summary: "Client withdraws pending request" })
  postRequestsIdWithdraw(
    @Param("id", new ParseUUIDPipe()) _id: string,
    @Body() _body: Dto.ReasonInput,
  ): never {
    return unavailable("Client withdraws pending request");
  }

  @Post("requests/:id/decline")
  @HttpCode(200)
  @ApiOperation({ summary: "Provider declines request" })
  postRequestsIdDecline(
    @Param("id", new ParseUUIDPipe()) _id: string,
    @Body() _body: Dto.ReasonInput,
  ): never {
    return unavailable("Provider declines request");
  }

  @Get("requests/:id/quotes")
  @HttpCode(200)
  @ApiOperation({ summary: "List quotes for participant request" })
  getRequestsIdQuotes(@Param("id", new ParseUUIDPipe()) _id: string): never {
    return unavailable("List quotes for participant request");
  }

  @Get("quotes")
  @HttpCode(200)
  @ApiOperation({ summary: "List participant quotes" })
  getQuotes(@Query() _query: Dto.ListQuery): never {
    return unavailable("List participant quotes");
  }

  @Get("quotes/:id")
  @HttpCode(200)
  @ApiOperation({ summary: "Read participant quote" })
  getQuotesId(@Param("id", new ParseUUIDPipe()) _id: string): never {
    return unavailable("Read participant quote");
  }

  @Post("quotes/:id/decline")
  @HttpCode(200)
  @ApiOperation({ summary: "Client declines quote" })
  postQuotesIdDecline(
    @Param("id", new ParseUUIDPipe()) _id: string,
    @Body() _body: Dto.ReasonInput,
  ): never {
    return unavailable("Client declines quote");
  }

  @Post("quotes/:id/cancel")
  @HttpCode(200)
  @ApiOperation({ summary: "Provider cancels sent quote" })
  postQuotesIdCancel(
    @Param("id", new ParseUUIDPipe()) _id: string,
    @Body() _body: Dto.ReasonInput,
  ): never {
    return unavailable("Provider cancels sent quote");
  }

  @Get("jobs/:id")
  @HttpCode(200)
  @ApiOperation({ summary: "Read participant job" })
  getJobsId(@Param("id", new ParseUUIDPipe()) _id: string): never {
    return unavailable("Read participant job");
  }

  @Post("jobs/:id/cancel")
  @HttpCode(200)
  @ApiOperation({ summary: "Cancel eligible participant job" })
  postJobsIdCancel(
    @Param("id", new ParseUUIDPipe()) _id: string,
    @Body() _body: Dto.ReasonInput,
  ): never {
    return unavailable("Cancel eligible participant job");
  }

  @Get("jobs/:id/milestones")
  @HttpCode(200)
  @ApiOperation({ summary: "List job milestones" })
  getJobsIdMilestones(@Param("id", new ParseUUIDPipe()) _id: string): never {
    return unavailable("List job milestones");
  }

  @Post("jobs/:id/milestones")
  @HttpCode(201)
  @ApiOperation({ summary: "Provider creates job milestone" })
  postJobsIdMilestones(
    @Param("id", new ParseUUIDPipe()) _id: string,
    @Body() _body: Dto.MilestoneInput,
  ): never {
    return unavailable("Provider creates job milestone");
  }

  @Patch("jobs/:id/milestones/:milestoneId")
  @HttpCode(200)
  @ApiOperation({ summary: "Provider updates job milestone" })
  patchJobsIdMilestonesMilestoneId(
    @Param("id", new ParseUUIDPipe()) _id: string,
    @Param("milestoneId", new ParseUUIDPipe()) _milestoneId: string,
    @Body() _body: Dto.MilestoneUpdateInput,
  ): never {
    return unavailable("Provider updates job milestone");
  }

  @Get("conversations")
  @HttpCode(200)
  @ApiOperation({ summary: "List own conversations" })
  getConversations(@Query() _query: Dto.ListQuery): never {
    return unavailable("List own conversations");
  }

  @Get("conversations/:id")
  @HttpCode(200)
  @ApiOperation({ summary: "Read participant conversation" })
  getConversationsId(@Param("id", new ParseUUIDPipe()) _id: string): never {
    return unavailable("Read participant conversation");
  }

  @Get("jobs/:id/conversation")
  @HttpCode(200)
  @ApiOperation({ summary: "Read conversation linked to job" })
  getJobsIdConversation(@Param("id", new ParseUUIDPipe()) _id: string): never {
    return unavailable("Read conversation linked to job");
  }

  @Get("requests/:id/conversation")
  @HttpCode(200)
  @ApiOperation({ summary: "Read conversation linked to request" })
  getRequestsIdConversation(
    @Param("id", new ParseUUIDPipe()) _id: string,
  ): never {
    return unavailable("Read conversation linked to request");
  }

  @Patch("conversations/:id/read")
  @HttpCode(200)
  @ApiOperation({ summary: "Mark conversation read" })
  patchConversationsIdRead(
    @Param("id", new ParseUUIDPipe()) _id: string,
  ): never {
    return unavailable("Mark conversation read");
  }

  @Patch("notifications/read-all")
  @HttpCode(200)
  @ApiOperation({ summary: "Mark all own notifications read" })
  patchNotificationsReadAll(): never {
    return unavailable("Mark all own notifications read");
  }

  @Get("me/notification-preferences")
  @HttpCode(200)
  @ApiOperation({ summary: "Read notification preferences" })
  getMeNotificationPreferences(): never {
    return unavailable("Read notification preferences");
  }

  @Patch("me/notification-preferences")
  @HttpCode(200)
  @ApiOperation({ summary: "Update notification preferences" })
  patchMeNotificationPreferences(@Body() _body: Dto.PreferencesInput): never {
    return unavailable("Update notification preferences");
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
  @Get("admin/provider-verifications")
  @HttpCode(200)
  @ApiOperation({ summary: "List provider-verifications for authorized staff" })
  getAdminProviderVerifications(@Query() _query: Dto.ListQuery): never {
    return unavailable("List provider-verifications for authorized staff");
  }

  @Get("admin/provider-verifications/:id")
  @HttpCode(200)
  @ApiOperation({ summary: "Read provider-verifications for authorized staff" })
  getAdminProviderVerificationsId(
    @Param("id", new ParseUUIDPipe()) _id: string,
  ): never {
    return unavailable("Read provider-verifications for authorized staff");
  }

  @Get("admin/providers")
  @HttpCode(200)
  @ApiOperation({ summary: "List providers for authorized staff" })
  getAdminProviders(@Query() _query: Dto.ListQuery): never {
    return unavailable("List providers for authorized staff");
  }

  @Get("admin/providers/:id")
  @HttpCode(200)
  @ApiOperation({ summary: "Read providers for authorized staff" })
  getAdminProvidersId(@Param("id", new ParseUUIDPipe()) _id: string): never {
    return unavailable("Read providers for authorized staff");
  }

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

  @Post("admin/provider-verifications/:id/decision")
  @HttpCode(201)
  @ApiOperation({ summary: "Record provider dimension decision" })
  postAdminProviderVerificationsIdDecision(
    @Param("id", new ParseUUIDPipe()) _id: string,
    @Body() _body: Dto.DecisionInput,
  ): never {
    return unavailable("Record provider dimension decision");
  }

  @Post("admin/providers/:id/decision")
  @HttpCode(201)
  @ApiOperation({ summary: "Record provider approval decision" })
  postAdminProvidersIdDecision(
    @Param("id", new ParseUUIDPipe()) _id: string,
    @Body() _body: Dto.ProviderDecisionInput,
  ): never {
    return unavailable("Record provider approval decision");
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

  @Get("admin/categories")
  @HttpCode(200)
  @ApiOperation({ summary: "List all categories" })
  getAdminCategories(@Query() _query: Dto.ListQuery): never {
    return unavailable("List all categories");
  }

  @Post("admin/categories")
  @HttpCode(201)
  @ApiOperation({ summary: "Create categories" })
  postAdminCategories(@Body() _body: Dto.CategoryInput): never {
    return unavailable("Create categories");
  }

  @Patch("admin/categories/:id")
  @HttpCode(200)
  @ApiOperation({ summary: "Update categories" })
  patchAdminCategoriesId(
    @Param("id", new ParseUUIDPipe()) _id: string,
    @Body() _body: Dto.CategoryUpdateInput,
  ): never {
    return unavailable("Update categories");
  }
}
