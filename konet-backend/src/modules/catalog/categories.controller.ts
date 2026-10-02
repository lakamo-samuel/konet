import {
  Body,
  Controller,
  Get,
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
  CategoryInput,
  CategoryUpdateInput,
  ListQuery,
} from "../contracts/contract.dto";
import { CategoriesService } from "./categories.service";
@ApiTags("admin")
@ApiBearerAuth()
@UseGuards(AuthGuard, StaffGuard)
@RequireRoles("admin")
@Controller({ path: "admin/categories", version: "1" })
export class CategoriesController {
  constructor(private service: CategoriesService) {}
  @Get() list(@Query() q: ListQuery) {
    return this.service.list(q);
  }
  @Post() create(@CurrentUser() u: AuthUser, @Body() d: CategoryInput) {
    return this.service.save(u.userId, d);
  }
  @Patch(":id") update(
    @CurrentUser() u: AuthUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() d: CategoryUpdateInput,
  ) {
    return this.service.save(u.userId, d, id);
  }
}
