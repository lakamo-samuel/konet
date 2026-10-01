import { Module } from "@nestjs/common";
import { StaffGuard } from "./staff.guard";
import { StaffController } from "./staff.controller";
import { StaffService } from "./staff.service";
@Module({
  providers: [StaffGuard, StaffService],
  controllers: [StaffController],
  exports: [StaffGuard],
})
export class AdministrationModule {}
