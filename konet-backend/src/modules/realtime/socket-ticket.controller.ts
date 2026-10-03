import {
  Controller,
  Post,
  Req,
  UseGuards,
  Header,
  HttpCode,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { AuthGuard } from "../../common/guards/auth.guard";
import { SocketTicketService } from "./socket-ticket.service";
@ApiTags("collaboration")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ version: "1" })
export class SocketTicketController {
  constructor(private tickets: SocketTicketService) {}
  @Post("auth/socket-ticket")
  @HttpCode(200)
  @Header("Cache-Control", "private, no-store")
  issue(@Req() request: Request) {
    // AuthGuard has checked this access token and its live database session.
    const token = /^Bearer\s+(\S+)$/i.exec(
      String(request.headers.authorization),
    )![1];
    return this.tickets.issue(token);
  }
}
