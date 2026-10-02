import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  AuthUser,
  CurrentUser,
} from "../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { StaffGuard, RequireRoles } from "../administration/staff.guard";
import {
  ListQuery,
  PayoutAccountInput,
  RefundInput,
  ReasonInput,
} from "../contracts/contract.dto";
import { SettlementService } from "./settlement.service";
@ApiTags("settlements")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ version: "1" })
export class SettlementController {
  constructor(private s: SettlementService) {}
  @Get("payout-banks") banks() {
    return this.s.banks();
  }
  @Get("me/payout-accounts") accounts(@CurrentUser() u: AuthUser) {
    return this.s.accounts(u.userId);
  }
  @Post("me/payout-accounts") add(
    @CurrentUser() u: AuthUser,
    @Body() d: PayoutAccountInput,
  ) {
    return this.s.addAccount(u.userId, d);
  }
  @Delete("me/payout-accounts/:id") @HttpCode(204) async remove(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    await this.s.removeAccount(u.userId, id);
  }
  @Get("jobs/:jobId/payout") payout(
    @CurrentUser() u: AuthUser,
    @Param("jobId", ParseUUIDPipe) id: string,
  ) {
    return this.s.payout(u.userId, id);
  }
  @Get("jobs/:jobId/refunds") refunds(
    @CurrentUser() u: AuthUser,
    @Param("jobId", ParseUUIDPipe) id: string,
  ) {
    return this.s.jobRefunds(u.userId, id);
  }
  @Get("me/payouts") payouts(
    @CurrentUser() u: AuthUser,
    @Query() q: ListQuery,
  ) {
    return this.s.ownPayouts(u.userId, q);
  }
  @Get("me/earnings") earnings(@CurrentUser() u: AuthUser) {
    return this.s.earnings(u.userId);
  }
}
@ApiTags("finance")
@ApiBearerAuth()
@UseGuards(AuthGuard, StaffGuard)
@RequireRoles("admin", "finance")
@Controller({ version: "1" })
export class FinanceSettlementController {
  constructor(private s: SettlementService) {}
  @Post("admin/payments/:id/refunds") @HttpCode(202) refund(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: RefundInput,
  ) {
    return this.s.requestRefund(u.userId, id, d);
  }
  @Post("admin/payouts/:id/retry") @HttpCode(202) retry(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: ReasonInput,
  ) {
    return this.s.retryPayout(u.userId, id, d.reason);
  }
  @Get("admin/payouts") payouts(@Query() q: ListQuery) {
    return this.s.adminPayouts(q);
  }
  @Get("admin/payouts/:id") payout(@Param("id", ParseUUIDPipe) id: string) {
    return this.s.adminPayout(id);
  }
}
