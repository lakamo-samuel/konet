import { StaffSecurityController } from "./staff-security.controller";
import { StaffSecurityService } from "./staff-security.service";
import { Module } from "@nestjs/common";
import { StaffGuard } from "./staff.guard";
import { StaffController } from "./staff.controller";
import { StaffService } from "./staff.service";
@Module({
  providers: [StaffGuard, StaffService, StaffSecurityService],
  controllers: [StaffController, StaffSecurityController],
  exports: [StaffGuard],
})
export class AdministrationModule {}
