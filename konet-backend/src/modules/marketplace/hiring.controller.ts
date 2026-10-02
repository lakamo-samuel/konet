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
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "../../common/guards/auth.guard";
import {
  AuthUser,
  CurrentUser,
} from "../../common/decorators/current-user.decorator";
import {
  ListQuery,
  QuoteInput,
  ReasonInput,
  RequestInput,
} from "../contracts/contract.dto";
import { HiringService } from "./hiring.service";
@ApiTags("hiring")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ version: "1" })
export class HiringController {
  constructor(private service: HiringService) {}
  @Post("requests") create(
    @CurrentUser() u: AuthUser,
    @Body() d: RequestInput,
  ) {
    return this.service.createRequest(u.userId, d);
  }
  @Get("requests") list(@CurrentUser() u: AuthUser, @Query() q: ListQuery) {
    return this.service.listRequests(u.userId, q);
  }
  @Get("requests/:id") request(
    @CurrentUser() u: AuthUser,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.service.request(u.userId, id);
  }
  @Post("requests/:id/withdraw") @HttpCode(200) withdraw(
    @CurrentUser() u: AuthUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() d: ReasonInput,
  ) {
    return this.service.closeRequest(u.userId, id, "withdrawn", d.reason);
  }
  @Post("requests/:id/decline") @HttpCode(200) decline(
    @CurrentUser() u: AuthUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() d: ReasonInput,
  ) {
    return this.service.closeRequest(u.userId, id, "declined", d.reason);
  }
  @Get("requests/:id/quotes") requestQuotes(
    @CurrentUser() u: AuthUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Query() q: ListQuery,
  ) {
    return this.service.requestQuotes(u.userId, id, q);
  }
  @Get("requests/:id/conversation") conversation(
    @CurrentUser() u: AuthUser,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.service.conversation(u.userId, id);
  }
  @Post("quotes") quote(@CurrentUser() u: AuthUser, @Body() d: QuoteInput) {
    return this.service.createQuote(u.userId, d);
  }
  @Get("quotes") quotes(@CurrentUser() u: AuthUser, @Query() q: ListQuery) {
    return this.service.listQuotes(u.userId, q);
  }
  @Get("quotes/:id") one(
    @CurrentUser() u: AuthUser,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.service.quote(u.userId, id);
  }
  @Post("quotes/:id/accept") accept(
    @CurrentUser() u: AuthUser,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.service.accept(u.userId, id);
  }
  @Post("quotes/:id/decline") @HttpCode(200) declineQuote(
    @CurrentUser() u: AuthUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() d: ReasonInput,
  ) {
    return this.service.closeQuote(u.userId, id, "declined", d.reason);
  }
  @Post("quotes/:id/cancel") @HttpCode(200) cancel(
    @CurrentUser() u: AuthUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() d: ReasonInput,
  ) {
    return this.service.closeQuote(u.userId, id, "cancelled", d.reason);
  }
}
