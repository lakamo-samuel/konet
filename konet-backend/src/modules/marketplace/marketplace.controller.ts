import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "../../common/guards/auth.guard";
import {
  AuthUser,
  CurrentUser,
} from "../../common/decorators/current-user.decorator";
import {
  CreateQuoteDto,
  CreateRequestDto,
  CreateServiceDto,
  DisputeDto,
  MessageDto,
  ReviewDto,
  UpdateServiceDto,
} from "./dto";
import { MarketplaceService } from "./marketplace.service";
@ApiTags("marketplace")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ version: "1" })
export class MarketplaceController {
  constructor(private s: MarketplaceService) {}
  @Post("services") service(
    @CurrentUser() u: AuthUser,
    @Body() d: CreateServiceDto,
  ) {
    return this.s.createService(u.userId, d);
  }
  @Get("me/services") myServices(@CurrentUser() u: AuthUser) {
    return this.s.myServices(u.userId);
  }
  @Patch("me/services/:id") updateService(@CurrentUser() u: AuthUser, @Param("id") id: string, @Body() d: UpdateServiceDto) {
    return this.s.updateService(u.userId, id, d);
  }
  @Delete("me/services/:id") @HttpCode(204) async archiveService(@CurrentUser() u: AuthUser, @Param("id") id: string) {
    await this.s.archiveService(u.userId, id);
  }
  @Post("requests") request(
    @CurrentUser() u: AuthUser,
    @Body() d: CreateRequestDto,
  ) {
    return this.s.request(u.userId, d);
  }
  @Get("requests") requests(@CurrentUser() u: AuthUser) {
    return this.s.listRequests(u.userId);
  }
  @Post("quotes") quote(@CurrentUser() u: AuthUser, @Body() d: CreateQuoteDto) {
    return this.s.quote(u.userId, d);
  }
  @Post("quotes/:id/accept") accept(
    @CurrentUser() u: AuthUser,
    @Param("id") id: string,
  ) {
    return this.s.acceptQuote(u.userId, id);
  }
  @Get("jobs") jobs(@CurrentUser() u: AuthUser) {
    return this.s.jobs(u.userId);
  }
  @Post("jobs/:id/start") start(
    @CurrentUser() u: AuthUser,
    @Param("id") id: string,
  ) {
    return this.s.transition(u.userId, id, "in_progress");
  }
  @Post("jobs/:id/mark-complete") markComplete(
    @CurrentUser() u: AuthUser,
    @Param("id") id: string,
  ) {
    return this.s.transition(u.userId, id, "awaiting_client_confirmation");
  }
  @Post("jobs/:id/confirm-completion") confirm(
    @CurrentUser() u: AuthUser,
    @Param("id") id: string,
  ) {
    return this.s.transition(u.userId, id, "completed");
  }
  @Get("conversations/:id/messages") messages(
    @CurrentUser() u: AuthUser,
    @Param("id") id: string,
  ) {
    return this.s.messages(u.userId, id);
  }
  @Post("conversations/:id/messages") send(
    @CurrentUser() u: AuthUser,
    @Param("id") id: string,
    @Body() d: MessageDto,
  ) {
    return this.s.send(u.userId, id, d);
  }
  @Post("reviews") review(@CurrentUser() u: AuthUser, @Body() d: ReviewDto) {
    return this.s.review(u.userId, d);
  }
  @Get("notifications") notifications(@CurrentUser() u: AuthUser) {
    return this.s.notifications(u.userId);
  }
  @Patch("notifications/:id/read") read(
    @CurrentUser() u: AuthUser,
    @Param("id") id: string,
  ) {
    return this.s.readNotification(u.userId, id);
  }
  @Post("jobs/:id/disputes") dispute(
    @CurrentUser() u: AuthUser,
    @Param("id") id: string,
    @Body() d: DisputeDto,
  ) {
    return this.s.dispute(u.userId, id, d);
  }
}
