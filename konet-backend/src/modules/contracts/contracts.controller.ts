import {
  Body,
  Controller,
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
  @Get("jobs/:id/review")
  @HttpCode(200)
  @ApiOperation({ summary: "Read review for participant job" })
  getJobsIdReview(@Param("id", new ParseUUIDPipe()) _id: string): never {
    return unavailable("Read review for participant job");
  }
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

  @Patch("admin/users/:id/status")
  @HttpCode(200)
  @ApiOperation({ summary: "Set account status with audit reason" })
  patchAdminUsersIdStatus(
    @Param("id", new ParseUUIDPipe()) _id: string,
    @Body() _body: Dto.AccountStatusInput,
  ): never {
    return unavailable("Set account status with audit reason");
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
