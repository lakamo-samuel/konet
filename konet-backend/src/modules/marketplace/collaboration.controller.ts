import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
  HttpCode,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "../../common/guards/auth.guard";
import {
  AuthUser,
  CurrentUser,
} from "../../common/decorators/current-user.decorator";
import {
  ListQuery,
  MilestoneInput,
  MilestoneUpdateInput,
  PreferencesInput,
  ReasonInput,
  MessageInput,
} from "../contracts/contract.dto";
import { CollaborationService } from "./collaboration.service";
@ApiTags("collaboration")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ version: "1" })
export class CollaborationController {
  constructor(private s: CollaborationService) {}
  @Get("jobs") jobs(@CurrentUser() u: AuthUser, @Query() q: ListQuery) {
    return this.s.jobs(u.userId, q);
  }
  @Get("jobs/:id") job(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.s.jobDetail(u.userId, id);
  }
  @Post("jobs/:id/start") @HttpCode(200) start(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.s.transition(u.userId, id, "in_progress");
  }
  @Post("jobs/:id/mark-complete") @HttpCode(200) complete(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.s.transition(u.userId, id, "awaiting_client_confirmation");
  }
  @Post("jobs/:id/confirm-completion") @HttpCode(200) confirm(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.s.transition(u.userId, id, "completed");
  }
  @Post("jobs/:id/cancel") @HttpCode(200) cancel(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: ReasonInput,
  ) {
    return this.s.transition(u.userId, id, "cancelled", d.reason);
  }
  @Get("jobs/:id/milestones") milestones(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.s.milestones(u.userId, id);
  }
  @Post("jobs/:id/milestones") create(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: MilestoneInput,
  ) {
    return this.s.saveMilestone(u.userId, id, d);
  }
  @Patch("jobs/:id/milestones/:milestoneId") update(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("milestoneId", ParseUUIDPipe) mid: string,
    @Body() d: MilestoneUpdateInput,
  ) {
    return this.s.saveMilestone(u.userId, id, d, mid);
  }
  @Get("conversations") conversations(
    @CurrentUser() u: AuthUser,
    @Query() q: ListQuery,
  ) {
    return this.s.conversations(u.userId, q);
  }
  @Get("conversations/:id") conversation(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.s.conversation(u.userId, id);
  }
  @Get("jobs/:id/conversation") jobConversation(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.s.jobConversation(u.userId, id);
  }
  @Get("conversations/:id/messages") messages(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Query() q: ListQuery,
  ) {
    return this.s.messages(u.userId, id, q);
  }
  @Post("conversations/:id/messages") send(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: MessageInput,
  ) {
    return this.s.send(u.userId, id, d.content);
  }
  @Patch("conversations/:id/read") read(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.s.readConversation(u.userId, id);
  }
  @Get("notifications") notifications(
    @CurrentUser() u: AuthUser,
    @Query() q: ListQuery,
  ) {
    return this.s.notifications(u.userId, q);
  }
  @Patch("notifications/read-all") all(@CurrentUser() u: AuthUser) {
    return this.s.readAll(u.userId);
  }
  @Patch("notifications/:id/read") readNotification(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.s.readNotification(u.userId, id);
  }
  @Get("me/notification-preferences") preferences(@CurrentUser() u: AuthUser) {
    return this.s.preferences(u.userId);
  }
  @Patch("me/notification-preferences") preferencesUpdate(
    @CurrentUser() u: AuthUser,
    @Body() d: PreferencesInput,
  ) {
    return this.s.updatePreferences(u.userId, d);
  }
}
