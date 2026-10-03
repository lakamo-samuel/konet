import { AdminFinanceController } from "./admin-finance.controller";
import { AdminFinanceService } from "./admin-finance.service";
import { ReconciliationService } from "./reconciliation.service";
import { SocketTicketController } from "../realtime/socket-ticket.controller";
import { SocketTicketService } from "../realtime/socket-ticket.service";
import { DisputeService } from "./dispute.service";
import {
  DisputeController,
  StaffDisputeController,
} from "./dispute.controller";
import {
  SettlementController,
  FinanceSettlementController,
} from "./settlement.controller";
import { SettlementService } from "./settlement.service";
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
  PaymentPolicyController,
  PaymentsController,
  PaymentWebhookController,
} from "./payments.controller";
import { PAYMENT_GATEWAY } from "../../infrastructure/payments/payment-gateway";
import { PaystackGateway } from "../../infrastructure/payments/paystack.gateway";
import { PaymentService } from "./payment.service";
@Module({
  imports: [ProvidersModule, AdministrationModule],
  controllers: [
    AdminFinanceController,
    SocketTicketController,
    DisputeController,
    StaffDisputeController,
    CategoriesController,
    CatalogController,
    HiringController,
    CollaborationController,
    MarketplaceController,
    PaymentPolicyController,
    PaymentsController,
    PaymentWebhookController,
    SettlementController,
    FinanceSettlementController,
  ],
  providers: [
    AdminFinanceService,
    ReconciliationService,
    DisputeService,
    MarketplaceService,
    HiringService,
    CollaborationService,
    RealtimePublisher,
    RealtimeServer,
    SocketTicketService,
    CategoriesService,
    PaystackGateway,
    PaymentService,
    SettlementService,
    { provide: PAYMENT_GATEWAY, useExisting: PaystackGateway },
  ],
})
export class MarketplaceModule {}
