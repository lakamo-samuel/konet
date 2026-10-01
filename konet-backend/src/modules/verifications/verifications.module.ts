import { Module } from "@nestjs/common";
import { EmailModule } from "../../infrastructure/email/email.module";
import { AdministrationModule } from "../administration/administration.module";
import { UploadsModule } from "../uploads/uploads.module";
import { VerificationsController } from "./verifications.controller";
import { VerificationsAdminController } from "./verifications-admin.controller";
import { VerificationsService } from "./verifications.service";
@Module({
  imports: [EmailModule, AdministrationModule, UploadsModule],
  controllers: [VerificationsController, VerificationsAdminController],
  providers: [VerificationsService],
})
export class VerificationsModule {}
