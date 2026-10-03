import {
  Body,
  Controller,
  Get,
  Post,
  HttpCode,
  Param,
  ParseUUIDPipe,
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
import { ListQuery, ReconciliationInput } from "../contracts/contract.dto";
import { AdminFinanceService } from "./admin-finance.service";
import { ReconciliationService } from "./reconciliation.service";
@ApiTags("administration finance")
@ApiBearerAuth()
@UseGuards(AuthGuard, StaffGuard)
@RequireRoles("admin", "finance")
@Controller({ path: "admin", version: "1" })
export class AdminFinanceController {
  constructor(
    private finance: AdminFinanceService,
    private reconciliation: ReconciliationService,
  ) {}
  @Get("payments") list(@Query() query: ListQuery) {
    return this.finance.list(query);
  }
  @Get("payments/:id") one(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.finance.one(id);
  }
  @Get("reports") report() {
    return this.finance.report();
  }
  @Post("reconciliations") @HttpCode(202) queue(
    @CurrentUser() user: AuthUser,
    @Body() input: ReconciliationInput,
  ) {
    return this.reconciliation.queue(user.userId, input);
  }
  @Get("reconciliations") runs(@Query() query: ListQuery) {
    return this.reconciliation.list(query);
  }
  @Get("reconciliations/:id") run(
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.reconciliation.one(id);
  }
}
