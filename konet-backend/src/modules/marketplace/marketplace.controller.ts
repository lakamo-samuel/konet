import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
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
  CreateServiceDto,
  DisputeDto,
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
  @Patch("me/services/:id") updateService(
    @CurrentUser() u: AuthUser,
    @Param("id") id: string,
    @Body() d: UpdateServiceDto,
  ) {
    return this.s.updateService(u.userId, id, d);
  }
  @Delete("me/services/:id") @HttpCode(204) async archiveService(
    @CurrentUser() u: AuthUser,
    @Param("id") id: string,
  ) {
    await this.s.archiveService(u.userId, id);
  }
  @Post("reviews") review(@CurrentUser() u: AuthUser, @Body() d: ReviewDto) {
    return this.s.review(u.userId, d);
  }
  @Post("jobs/:id/disputes") dispute(
    @CurrentUser() u: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: DisputeDto,
  ) {
    return this.s.dispute(u.userId, id, d);
  }
}
