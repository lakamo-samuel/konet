import { Module } from "@nestjs/common";
import { UniversitiesController } from "./universities.controller";
import {
  UniversitiesAdminController,
  DirectoryAuditController,
} from "./universities-admin.controller";
import { UniversitiesService } from "./universities.service";
import { AdministrationModule } from "../administration/administration.module";
@Module({
  controllers: [
    UniversitiesController,
    UniversitiesAdminController,
    DirectoryAuditController,
  ],
  imports: [AdministrationModule],
  providers: [UniversitiesService],
})
export class UniversitiesModule {}
