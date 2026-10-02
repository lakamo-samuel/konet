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
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "../../common/guards/auth.guard";
import {
  AuthUser,
  CurrentUser,
} from "../../common/decorators/current-user.decorator";
import { RequireRoles, StaffGuard } from "../administration/staff.guard";
import {
  ProviderEvidenceDecisionInput,
  ListQuery,
  OnboardingStepInput,
  PortfolioInput,
  PortfolioUpdateInput,
  ProviderDecisionInput,
  ProviderEvidenceInput,
  ProviderInput,
  ProviderStatusInput,
  ProviderUpdateInput,
} from "../contracts/contract.dto";
import { ProviderOnboardingService } from "./provider-onboarding.service";
@ApiTags("provider onboarding")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ version: "1" })
export class ProviderOnboardingController {
  constructor(private service: ProviderOnboardingService) {}
  @Post("me/provider-profile") create(
    @CurrentUser() u: AuthUser,
    @Body() input: ProviderInput,
  ) {
    return this.service.create(u.userId, input);
  }
  @Get("me/provider-profile") own(@CurrentUser() u: AuthUser) {
    return this.service.own(u.userId);
  }
  @Patch("me/provider-profile") update(
    @CurrentUser() u: AuthUser,
    @Body() input: ProviderUpdateInput,
  ) {
    return this.service.update(u.userId, input);
  }
  @Get("me/provider-verifications") dimensions(@CurrentUser() u: AuthUser) {
    return this.service.ownDimensions(u.userId);
  }
  @Post("me/provider-verifications") evidence(
    @CurrentUser() u: AuthUser,
    @Body() input: ProviderEvidenceInput,
  ) {
    return this.service.submitEvidence(u.userId, input);
  }
  @Post("me/provider-profile/submit") @HttpCode(202) submit(
    @CurrentUser() u: AuthUser,
  ) {
    return this.service.submit(u.userId);
  }
  @Post("me/provider-profile/publish") @HttpCode(200) publish(
    @CurrentUser() u: AuthUser,
  ) {
    return this.service.setStatus(u.userId, "active");
  }
  @Patch("me/provider-profile/status") status(
    @CurrentUser() u: AuthUser,
    @Body() input: ProviderStatusInput,
  ) {
    return this.service.setStatus(
      u.userId,
      input.status as "active" | "paused",
    );
  }
  @Get("me/provider-onboarding") onboarding(@CurrentUser() u: AuthUser) {
    return this.service.onboarding(u.userId);
  }
  @Patch("me/provider-onboarding/steps/:step") step(
    @CurrentUser() u: AuthUser,
    @Param("step") step: string,
    @Body() input: OnboardingStepInput,
  ) {
    return this.service.saveStep(u.userId, step, input);
  }
  @Get("me/portfolio") portfolio(@CurrentUser() u: AuthUser) {
    return this.service.portfolio(u.userId);
  }
  @Post("me/portfolio") addPortfolio(
    @CurrentUser() u: AuthUser,
    @Body() input: PortfolioInput,
  ) {
    return this.service.addPortfolio(u.userId, input);
  }
  @Patch("me/portfolio/:id") updatePortfolio(
    @CurrentUser() u: AuthUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() input: PortfolioUpdateInput,
  ) {
    return this.service.updatePortfolio(u.userId, id, input);
  }
  @Delete("me/portfolio/:id") @HttpCode(204) async deletePortfolio(
    @CurrentUser() u: AuthUser,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    await this.service.deletePortfolio(u.userId, id);
  }
}
@ApiTags("admin")
@ApiBearerAuth()
@UseGuards(AuthGuard, StaffGuard)
@RequireRoles("admin", "reviewer")
@Controller({ path: "admin", version: "1" })
export class ProviderReviewController {
  constructor(private service: ProviderOnboardingService) {}
  @Get("provider-verifications") dimensions(@Query() q: ListQuery) {
    return this.service.reviewQueue(q, true);
  }
  @Get("provider-verifications/:id") dimension(
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.service.reviewDetail(id, true);
  }
  @Post("provider-verifications/:id/decision") decideDimension(
    @CurrentUser() u: AuthUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() input: ProviderEvidenceDecisionInput,
  ) {
    return this.service.decideEvidence(u.userId, id, input);
  }
  @Get("providers") profiles(@Query() q: ListQuery) {
    return this.service.reviewQueue(q, false);
  }
  @Get("providers/:id") profile(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.service.reviewDetail(id, false);
  }
  @Post("providers/:id/decision") decideProfile(
    @CurrentUser() u: AuthUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() input: ProviderDecisionInput,
  ) {
    return this.service.decideProfile(u.userId, id, input);
  }
}
