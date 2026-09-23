import { Module } from "@nestjs/common";
import { VerificationsController } from "./verifications.controller";
@Module({ controllers: [VerificationsController] })
export class VerificationsModule {}
