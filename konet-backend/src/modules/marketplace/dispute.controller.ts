import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  CurrentUser,
  AuthUser,
} from "../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { RequireRoles, StaffGuard } from "../administration/staff.guard";
import { DisputeDecisionInput, ListQuery } from "../contracts/contract.dto";
import { DisputeService } from "./dispute.service";
@ApiTags("disputes")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ version: "1" })
export class DisputeController {
  constructor(private s: DisputeService) {}
  @Get("disputes") list(@CurrentUser() u: AuthUser, @Query() q: ListQuery) {
    return this.s.list(u.userId, q);
  }
  @Get("disputes/:id") detail(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.s.detail(u.userId, id);
  }
  @Get("disputes/:id/decisions") decisions(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.s.decisions(u.userId, id);
  }
}
@ApiTags("administration")
@ApiBearerAuth()
@UseGuards(AuthGuard, StaffGuard)
@RequireRoles("admin", "finance")
@Controller({ version: "1" })
export class StaffDisputeController {
  constructor(private s: DisputeService) {}
  @Get("admin/disputes") list(@Query() q: ListQuery) {
    return this.s.list(undefined, q);
  }
  @Get("admin/disputes/:id") detail(@Param("id", ParseUUIDPipe) id: string) {
    return this.s.detail(undefined, id);
  }
  @Post("admin/disputes/:id/decision") decide(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: DisputeDecisionInput,
  ) {
    return this.s.decide(u.userId, id, d);
  }
}
