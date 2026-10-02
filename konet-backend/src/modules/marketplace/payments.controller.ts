import {
  Controller,
  Get,
  Post,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
  HttpCode,
  Req,
  RawBodyRequest,
  Headers,
} from "@nestjs/common";
import { Request } from "express";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  AuthUser,
  CurrentUser,
} from "../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { ListQuery } from "../contracts/contract.dto";
import { PaymentService } from "./payment.service";
@ApiTags("payments")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ version: "1" })
export class PaymentsController {
  constructor(private s: PaymentService) {}
  @Get("jobs/:jobId/payment") get(
    @CurrentUser() u: AuthUser,
    @Param("jobId", ParseUUIDPipe) id: string,
  ) {
    return this.s.get(u.userId, id);
  }
  @Post("jobs/:jobId/payments") initialize(
    @CurrentUser() u: AuthUser,
    @Param("jobId", ParseUUIDPipe) id: string,
  ) {
    return this.s.initialize(u.userId, id);
  }
  @Post("jobs/:jobId/payment/verify") @HttpCode(200) verify(
    @CurrentUser() u: AuthUser,
    @Param("jobId", ParseUUIDPipe) id: string,
  ) {
    return this.s.verify(u.userId, id);
  }
  @Get("me/payments") list(@CurrentUser() u: AuthUser, @Query() q: ListQuery) {
    return this.s.list(u.userId, q);
  }
}
@ApiTags("payment webhooks")
@Controller({ version: "1" })
export class PaymentWebhookController {
  constructor(private s: PaymentService) {}
  @Post("webhooks/payments/:gateway") @HttpCode(200) webhook(
    @Param("gateway") gateway: string,
    @Headers("x-paystack-signature") signature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    return this.s.webhook(gateway, signature ?? "", req.rawBody);
  }
}
