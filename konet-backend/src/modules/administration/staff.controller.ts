import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
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
import { ReasonInput } from "../contracts/contract.dto";
import { RequireRoles, StaffGuard, StaffRole } from "./staff.guard";
import { StaffRoleInput, StaffUsersQuery } from "./staff.dto";
import { StaffService } from "./staff.service";
@ApiTags("administration")
@ApiBearerAuth()
@UseGuards(AuthGuard, StaffGuard)
@RequireRoles("admin")
@Controller({ path: "admin/users", version: "1" })
export class StaffController {
  constructor(private service: StaffService) {}
  @Get() list(@Query() query: StaffUsersQuery) {
    return this.service.list(query);
  }
  @Get(":id") one(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.service.one(id);
  }
  @Get(":id/roles") roles(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.service.roles(id);
  }
  @Post(":id/roles") grant(
    @CurrentUser() user: AuthUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: StaffRoleInput,
  ) {
    return this.service.change(user.userId, id, body.role, body.reason, true);
  }
  @Delete(":id/roles/:role") revoke(
    @CurrentUser() user: AuthUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Param(
      "role",
      new ParseEnumPipe({
        admin: "admin",
        reviewer: "reviewer",
        support: "support",
        finance: "finance",
      }),
    )
    role: StaffRole,
    @Body() body: ReasonInput,
  ) {
    return this.service.change(user.userId, id, role, body.reason, false);
  }
}
