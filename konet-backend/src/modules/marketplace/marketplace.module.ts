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
import {
  PaymentsController,
  PaymentWebhookController,
} from "./payments.controller";
import { PAYMENT_GATEWAY } from "../../infrastructure/payments/payment-gateway";
import { PaystackGateway } from "../../infrastructure/payments/paystack.gateway";
import { PaymentService } from "./payment.service";
@Module({
  imports: [ProvidersModule, AdministrationModule],
  controllers: [
    CategoriesController,
    CatalogController,
    HiringController,
    CollaborationController,
    MarketplaceController,
    PaymentsController,
    PaymentWebhookController,
  ],
  providers: [
    MarketplaceService,
    HiringService,
    CollaborationService,
    RealtimePublisher,
    RealtimeServer,
    CategoriesService,
    PaystackGateway,
    PaymentService,
    { provide: PAYMENT_GATEWAY, useExisting: PaystackGateway },
  ],
})
export class MarketplaceModule {}
