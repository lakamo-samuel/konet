import { Module } from "@nestjs/common";
import { AdministrationModule } from "../administration/administration.module";
import { UploadsModule } from "../uploads/uploads.module";
import { ProvidersController } from "./providers.controller";
import { ProvidersService } from "./providers.service";
import {
  ProviderOnboardingController,
  ProviderReviewController,
} from "./provider-onboarding.controller";
import { ProviderOnboardingService } from "./provider-onboarding.service";
@Module({
  imports: [AdministrationModule, UploadsModule],
  controllers: [
    ProvidersController,
    ProviderOnboardingController,
    ProviderReviewController,
  ],
  providers: [ProvidersService, ProviderOnboardingService],
  exports: [ProvidersService, ProviderOnboardingService],
})
export class ProvidersModule {}
