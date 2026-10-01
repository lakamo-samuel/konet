import { Module } from "@nestjs/common";
import { UploadsController } from "./uploads.controller";
import { UploadsService } from "./uploads.service";
import { CloudinaryGateway } from "./cloudinary.gateway";
@Module({
  controllers: [UploadsController],
  providers: [UploadsService, CloudinaryGateway],
  exports: [UploadsService],
})
export class UploadsModule {}
