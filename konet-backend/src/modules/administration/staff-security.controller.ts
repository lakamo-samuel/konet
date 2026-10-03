import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiOkResponse,
  ApiCreatedResponse,
} from "@nestjs/swagger";
import { AuthGuard } from "../../common/guards/auth.guard";
import {
  AuthUser,
  CurrentUser,
} from "../../common/decorators/current-user.decorator";
import { RequireRoles, StaffGuard, StaffSecuritySetup } from "./staff.guard";
import { StaffSecurityService } from "./staff-security.service";
import {
  StaffEnrollmentInput,
  StaffVerificationInput,
} from "./staff-security.dto";
@ApiTags("staff security")
@ApiBearerAuth()
@UseGuards(AuthGuard, StaffGuard)
@RequireRoles("admin", "reviewer", "finance", "support")
@StaffSecuritySetup()
@Controller({ path: "me/staff-security", version: "1" })
export class StaffSecurityController {
  constructor(private service: StaffSecurityService) {}
  @Get()
  @ApiOkResponse({
    schema: {
      type: "object",
      required: ["enabled", "verified", "recoveryCodesRemaining"],
      properties: {
        enabled: { type: "boolean" },
        verified: { type: "boolean" },
        expiresAt: { type: "string", format: "date-time", nullable: true },
        recoveryCodesRemaining: { type: "integer" },
      },
    },
  })
  @ApiOperation({
    summary:
      "Read staff authenticator enrollment and current session verification",
  })
  status(@CurrentUser() user: AuthUser) {
    return this.service.status(user);
  }
  @Post("enrollment")
  @ApiCreatedResponse({
    schema: {
      type: "object",
      required: ["secret", "uri", "expiresAt"],
      properties: {
        secret: {
          type: "string",
          description:
            "Authenticator setup secret; display once, never persist in browser storage",
        },
        uri: { type: "string" },
        expiresAt: { type: "string", format: "date-time" },
      },
    },
  })
  @ApiOperation({
    summary:
      "Begin authenticator enrollment after password verification; expires in ten minutes",
  })
  enroll(@CurrentUser() user: AuthUser, @Body() input: StaffEnrollmentInput) {
    return this.service.enroll(user, input.password);
  }
  @Post("confirm")
  @ApiCreatedResponse({
    schema: {
      type: "object",
      properties: {
        verified: { type: "boolean" },
        expiresAt: { type: "string", format: "date-time" },
        recoveryCodes: {
          type: "array",
          items: { type: "string" },
          description:
            "Ten one-use recovery codes; displayed only in this response",
        },
      },
    },
  })
  @ApiOperation({
    summary: "Confirm enrollment; returns ten one-use recovery codes once",
  })
  confirm(
    @CurrentUser() user: AuthUser,
    @Body() input: StaffVerificationInput,
  ) {
    return this.service.verify(user, input.code, true);
  }
  @Post("verify")
  @ApiCreatedResponse({
    schema: {
      type: "object",
      properties: {
        verified: { type: "boolean" },
        expiresAt: { type: "string", format: "date-time" },
      },
    },
  })
  @ApiOperation({
    summary:
      "Verify an authenticator or recovery code; authorizes this session for fifteen minutes",
  })
  verify(@CurrentUser() user: AuthUser, @Body() input: StaffVerificationInput) {
    return this.service.verify(user, input.code);
  }
}
