export type PaymentInitialization = { checkoutUrl: string; reference: string };
export interface PaymentGateway {
  initialize(input: {
    paymentId: string;
    amountMinor: number;
    currency: string;
    callbackUrl: string;
  }): Promise<PaymentInitialization>;
  verify(reference: string): Promise<{ reference: string; status: string }>;
  refund(input: {
    reference: string;
    amountMinor: number;
    idempotencyKey: string;
  }): Promise<void>;
  verifyWebhook(
    signature: string,
    payload: Buffer,
  ): Promise<{ eventId: string; reference: string; status: string }>;
}
export const PAYMENT_GATEWAY = Symbol("PAYMENT_GATEWAY");
