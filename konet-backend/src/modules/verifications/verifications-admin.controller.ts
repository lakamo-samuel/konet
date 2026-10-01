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
  AuthUser,
  CurrentUser,
} from "../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { RequireRoles, StaffGuard } from "../administration/staff.guard";
import { DecisionInput } from "../contracts/contract.dto";
import { VerificationQuery } from "./verifications.dto";
import { VerificationsService } from "./verifications.service";
@ApiTags("admin")
@ApiBearerAuth()
@UseGuards(AuthGuard, StaffGuard)
@RequireRoles("admin", "reviewer")
@Controller({ path: "admin/student-verifications", version: "1" })
export class VerificationsAdminController {
  constructor(private service: VerificationsService) {}
  @Get() list(@Query() query: VerificationQuery) {
    return this.service.queue(query);
  }
  @Get(":id") detail(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.service.detail(id);
  }
  @Post(":id/decision") decide(
    @CurrentUser() user: AuthUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() input: DecisionInput,
  ) {
    return this.service.decide(user.userId, id, input);
  }
}
