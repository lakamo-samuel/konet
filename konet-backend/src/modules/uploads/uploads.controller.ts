import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { AuthGuard } from "../../common/guards/auth.guard";
import {
  AuthUser,
  CurrentUser,
} from "../../common/decorators/current-user.decorator";
import {
  AvatarUploadCompleteInput,
  AvatarUploadInput,
  UploadInput,
} from "../contracts/contract.dto";
import { UploadsService } from "./uploads.service";
@ApiTags("uploads")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ path: "uploads", version: "1" })
export class UploadsController {
  constructor(private service: UploadsService) {}
  @Post("presign") @Throttle({ default: { limit: 10, ttl: 60000 } }) ticket(
    @CurrentUser() user: AuthUser,
    @Body() body: UploadInput,
  ) {
    return this.service.ticket(user.userId, body);
  }
  @Post("avatar")
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  avatarTicket(
    @CurrentUser() user: AuthUser,
    @Body() body: AvatarUploadInput,
  ) {
    return this.service.avatarTicket(user.userId, body);
  }
  @Post("provider-cover")
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  providerCoverTicket(
    @CurrentUser() user: AuthUser,
    @Body() body: AvatarUploadInput,
  ) {
    return this.service.providerCoverTicket(user.userId, body);
  }
  @Post("avatar/complete")
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  completeAvatar(
    @CurrentUser() user: AuthUser,
    @Body() body: AvatarUploadCompleteInput,
  ) {
    return this.service.completeAvatar(user.userId, body.publicId);
  }
  @Post("provider-cover/complete")
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  completeProviderCover(
    @CurrentUser() user: AuthUser,
    @Body() body: AvatarUploadCompleteInput,
  ) {
    return this.service.completeProviderCover(user.userId, body.publicId);
  }
  @Post("portfolio-image")
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  portfolioImageTicket(
    @CurrentUser() user: AuthUser,
    @Body() body: AvatarUploadInput,
  ) {
    return this.service.portfolioImageTicket(user.userId, body);
  }
  @Post("portfolio-image/complete")
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  completePortfolioImage(
    @CurrentUser() user: AuthUser,
    @Body() body: AvatarUploadCompleteInput,
  ) {
    return this.service.completePortfolioImage(user.userId, body.publicId);
  }
  @Post(":id/complete") @HttpCode(202) complete(
    @CurrentUser() user: AuthUser,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.service.complete(user.userId, id);
  }
  @Get(":id") get(
    @CurrentUser() user: AuthUser,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.service.get(user.userId, id);
  }
  @Get(":id/download") download(
    @CurrentUser() user: AuthUser,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.service.download(user.userId, id, user.sid);
  }
  @Delete(":id") @HttpCode(204) async remove(
    @CurrentUser() user: AuthUser,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    await this.service.remove(user.userId, id);
  }
}
