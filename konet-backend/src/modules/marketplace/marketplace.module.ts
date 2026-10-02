import { RealtimePublisher } from "../realtime/realtime.publisher";
import { RealtimeServer } from "../realtime/realtime.server";
import { CollaborationController } from "./collaboration.controller";
import { CollaborationService } from "./collaboration.service";
import { AdministrationModule } from "../administration/administration.module";
import { CategoriesController } from "../catalog/categories.controller";
import { CategoriesService } from "../catalog/categories.service";
import { ProvidersModule } from "../providers/providers.module";
import { HiringController } from "./hiring.controller";
import { HiringService } from "./hiring.service";
import { Module } from "@nestjs/common";
import { CatalogController } from "./catalog.controller";
import { MarketplaceController } from "./marketplace.controller";
import { MarketplaceService } from "./marketplace.service";
import { PaymentsController } from "./payments.controller";
import { PAYMENT_GATEWAY } from "../../infrastructure/payments/payment-gateway";
import { UnconfiguredPaymentGateway } from "../../infrastructure/payments/unconfigured.gateway";
@Module({
  imports: [ProvidersModule, AdministrationModule],
  controllers: [
    CategoriesController,
    CatalogController,
    HiringController,
    CollaborationController,
    MarketplaceController,
    PaymentsController,
  ],
  providers: [
    MarketplaceService,
    HiringService,
    CollaborationService,
    RealtimePublisher,
    RealtimeServer,
    CategoriesService,
    { provide: PAYMENT_GATEWAY, useClass: UnconfiguredPaymentGateway },
  ],
})
export class MarketplaceModule {}
