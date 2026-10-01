import { Module } from "@nestjs/common";
import {
  PublicContractsController,
  MemberContractsController,
  AdminContractsController,
} from "./contracts.controller";

@Module({
  controllers: [
    PublicContractsController,
    MemberContractsController,
    AdminContractsController,
  ],
})
export class ContractsModule {}
