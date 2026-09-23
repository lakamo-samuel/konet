import { Module } from "@nestjs/common";
import { CatalogController } from "./catalog.controller";
import { MarketplaceController } from "./marketplace.controller";
import { MarketplaceService } from "./marketplace.service";
import { PaymentsController } from "./payments.controller";
import { PAYMENT_GATEWAY } from "../../infrastructure/payments/payment-gateway";
import { UnconfiguredPaymentGateway } from "../../infrastructure/payments/unconfigured.gateway";
@Module({
  controllers: [CatalogController, MarketplaceController, PaymentsController],
  providers: [
    MarketplaceService,
    { provide: PAYMENT_GATEWAY, useClass: UnconfiguredPaymentGateway },
  ],
})
export class MarketplaceModule {}
