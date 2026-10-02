import { Module } from "@nestjs/common";
import { AdminContractsController } from "./contracts.controller";

@Module({
  controllers: [AdminContractsController],
})
export class ContractsModule {}
