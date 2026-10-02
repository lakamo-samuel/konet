import { AccountService } from "./account.service";
import {
  Body,
  Controller,
  Delete,
  Patch,
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
import {
  ProfileInput,
  EmailChangeInput,
  ConfirmChallengeInput,
  ReasonInput,
  PasswordChangeInput,
} from "../contracts/contract.dto";
import { AuthService } from "./auth.service";

@ApiTags("account")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ path: "me", version: "1" })
export class AccountController {
  constructor(
    private auth: AuthService,
    private account: AccountService,
  ) {}
  @Patch("profile")
  profile(@CurrentUser() u: AuthUser, @Body() d: ProfileInput) {
    return this.account.profile(u.userId, d);
  }
  @Post("email-change")
  @HttpCode(202)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  email(@CurrentUser() u: AuthUser, @Body() d: EmailChangeInput) {
    return this.account.requestEmail(u.userId, d);
  }
  @Post("email-change/confirm")
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async confirm(
    @CurrentUser() u: AuthUser,
    @Body() d: ConfirmChallengeInput,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.account.confirmEmail(u.userId, d);
    response.clearCookie("konet_refresh", { path: "/api/v1/auth" });
    return result;
  }
  @Delete("account")
  @HttpCode(204)
  async deactivate(
    @CurrentUser() u: AuthUser,
    @Body() d: ReasonInput,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.account.deactivate(u.userId, d.reason);
    response.clearCookie("konet_refresh", { path: "/api/v1/auth" });
  }

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
