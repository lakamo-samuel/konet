import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
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

@ApiTags("admin contracts")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ version: "1" })
export class AdminContractsController {
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
