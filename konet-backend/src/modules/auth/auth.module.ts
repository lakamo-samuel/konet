import { AccountController } from "./account.controller";
import { EmailModule } from "../../infrastructure/email/email.module";
import { Global, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
@Global()
@Module({
  imports: [JwtModule.register({}), EmailModule],
  controllers: [AuthController, AccountController],
  providers: [AuthService],
  exports: [JwtModule, AuthService],
})
export class AuthModule {}
