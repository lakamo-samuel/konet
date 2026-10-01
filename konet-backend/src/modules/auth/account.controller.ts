import {
  Body,
  Controller,
  HttpCode,
  Post,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Response } from "express";
import { AuthGuard } from "../../common/guards/auth.guard";
import {
  AuthUser,
  CurrentUser,
} from "../../common/decorators/current-user.decorator";
import { PasswordChangeInput } from "../contracts/contract.dto";
import { AuthService } from "./auth.service";

@ApiTags("account")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ path: "me", version: "1" })
export class AccountController {
  constructor(private auth: AuthService) {}
  @Post("password")
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async password(
    @CurrentUser() user: AuthUser,
    @Body() dto: PasswordChangeInput,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.changePassword(
      user.userId,
      dto.currentPassword,
      dto.newPassword,
    );
    response.clearCookie("konet_refresh", { path: "/api/v1/auth" });
    return result;
  }
}
