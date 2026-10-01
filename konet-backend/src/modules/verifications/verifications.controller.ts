import {
  Body,
  Controller,
  Get,
  Post,
  HttpCode,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import {
  AuthUser,
  CurrentUser,
} from "../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import {
  ConfirmChallengeInput,
  EmailChallengeInput,
  StudentVerificationInput,
} from "../contracts/contract.dto";
import { VerificationsService } from "./verifications.service";
@ApiTags("verification")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ path: "me/student-verification", version: "1" })
export class VerificationsController {
  constructor(private service: VerificationsService) {}
  @Get() list(@CurrentUser() user: AuthUser) {
    return this.service.history(user.userId);
  }
  @Post() submit(
    @CurrentUser() user: AuthUser,
    @Body() input: StudentVerificationInput,
  ) {
    return this.service.submit(user.userId, input);
  }
  @Post("email-challenges")
  @HttpCode(202)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  challenge(@CurrentUser() user: AuthUser, @Body() input: EmailChallengeInput) {
    return this.service.challenge(user.userId, input);
  }
  @Post("email-challenges/confirm")
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  confirm(@CurrentUser() user: AuthUser, @Body() input: ConfirmChallengeInput) {
    return this.service.confirm(user.userId, input);
  }
}
