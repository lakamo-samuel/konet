import { Injectable } from "@nestjs/common";
import { DomainError } from "../../common/errors/domain.error";
import { PaymentGateway } from "./payment-gateway";
@Injectable()
export class UnconfiguredPaymentGateway implements PaymentGateway {
  private unavailable(): never {
    throw new DomainError(
      "PAYMENT_GATEWAY_NOT_CONFIGURED",
      "Payment processing is unavailable until a verified gateway is configured.",
      503,
    );
  }
  async initialize(): Promise<never> {
    return this.unavailable();
  }
  async verify(): Promise<never> {
    return this.unavailable();
  }
  async refund(): Promise<never> {
    return this.unavailable();
  }
  async verifyWebhook(): Promise<never> {
    return this.unavailable();
  }
}
