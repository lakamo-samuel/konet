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
import { UploadInput } from "../contracts/contract.dto";
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
    return this.service.download(user.userId, id);
  }
  @Delete(":id") @HttpCode(204) async remove(
    @CurrentUser() user: AuthUser,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    await this.service.remove(user.userId, id);
  }
}
