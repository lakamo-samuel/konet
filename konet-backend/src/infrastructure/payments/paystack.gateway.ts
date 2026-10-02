import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "node:crypto";
import { DomainError } from "../../common/errors/domain.error";
import {
  PaymentGateway,
  PaymentInitialization,
  VerifiedPayment,
} from "./payment-gateway";
@Injectable()
export class PaystackGateway implements PaymentGateway {
  constructor(private config: ConfigService) {}
  assertConfigured() {
    if (!this.config.get<string>("PAYSTACK_SECRET_KEY"))
      throw new DomainError(
        "PAYMENT_GATEWAY_NOT_CONFIGURED",
        "Configure Paystack before processing payments.",
        503,
      );
  }
  private async call(path: string, body?: unknown) {
    this.assertConfigured();
    let response: Response;
    try {
      response = await fetch(`https://api.paystack.co${path}`, {
        method: body ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${this.config.getOrThrow("PAYSTACK_SECRET_KEY")}`,
          "Content-Type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      throw new DomainError(
        "PAYMENT_PROVIDER_UNAVAILABLE",
        "Paystack could not be reached. Verify before retrying.",
        503,
      );
    }
    let result: any;
    try {
      result = await response.json();
    } catch {
      throw new DomainError(
        "PAYMENT_PROVIDER_UNAVAILABLE",
        "Invalid Paystack response.",
        503,
      );
    }
    if (!response.ok || result.status !== true)
      throw new DomainError(
        "PAYMENT_PROVIDER_UNAVAILABLE",
        "Paystack did not confirm the operation. Verify before retrying.",
        503,
      );
    if (
      !result.data ||
      typeof result.data !== "object" ||
      Array.isArray(result.data)
    )
      throw new DomainError(
        "PAYMENT_PROVIDER_MISMATCH",
        "Incomplete Paystack response.",
        502,
      );
    return result.data;
  }
  async initialize(
    input: Parameters<PaymentGateway["initialize"]>[0],
  ): Promise<PaymentInitialization> {
    const data = await this.call("/transaction/initialize", {
      email: input.email,
      amount: String(input.amountMinor),
      currency: input.currency,
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: JSON.stringify({ paymentId: input.paymentId }),
    });
    if (
      data.reference !== input.reference ||
      typeof data.authorization_url !== "string"
    )
      throw new DomainError(
        "PAYMENT_PROVIDER_MISMATCH",
        "Paystack returned an unexpected reference.",
        502,
      );
    const url = new URL(data.authorization_url);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "checkout.paystack.com" ||
      url.username ||
      url.password
    )
      throw new DomainError(
        "PAYMENT_PROVIDER_MISMATCH",
        "Paystack returned an invalid checkout URL.",
        502,
      );
    return { reference: data.reference, checkoutUrl: data.authorization_url };
  }
  async verify(reference: string): Promise<VerifiedPayment> {
    const data = await this.call(
      `/transaction/verify/${encodeURIComponent(reference)}`,
    );
    if (
      typeof data.reference !== "string" ||
      typeof data.status !== "string" ||
      !Number.isSafeInteger(data.amount) ||
      typeof data.currency !== "string" ||
      !Number.isSafeInteger(data.id) ||
      typeof data.customer?.email !== "string"
    )
      throw new DomainError(
        "PAYMENT_PROVIDER_MISMATCH",
        "Incomplete payment verification response.",
        502,
      );
    let metadata = data.metadata;
    if (typeof metadata === "string") {
      try {
        metadata = JSON.parse(metadata);
      } catch {
        metadata = undefined;
      }
    }
    return {
      reference: data.reference,
      status: data.status,
      amountMinor: data.amount,
      currency: data.currency,
      transactionId: String(data.id),
      email: data.customer.email,
      paymentId: metadata?.paymentId,
    };
  }
  async verifyWebhook(signature: string, payload: Buffer) {
    this.assertConfigured();
    if (!/^[a-f0-9]{128}$/i.test(signature))
      throw new DomainError(
        "INVALID_WEBHOOK_SIGNATURE",
        "Invalid Paystack signature.",
        401,
      );
    const expected = createHmac(
      "sha512",
      this.config.getOrThrow<string>("PAYSTACK_SECRET_KEY"),
    )
      .update(payload)
      .digest();
    if (!timingSafeEqual(expected, Buffer.from(signature, "hex")))
      throw new DomainError(
        "INVALID_WEBHOOK_SIGNATURE",
        "Invalid Paystack signature.",
        401,
      );
    let value: any;
    try {
      value = JSON.parse(payload.toString("utf8"));
    } catch {
      throw new DomainError(
        "INVALID_WEBHOOK_PAYLOAD",
        "Invalid webhook payload.",
        400,
      );
    }
    if (value.event !== "charge.success")
      return { eventId: "ignored", reference: "", status: "ignored" };
    if (
      typeof value.data?.reference !== "string" ||
      !Number.isSafeInteger(value.data?.id)
    )
      throw new DomainError(
        "INVALID_WEBHOOK_PAYLOAD",
        "Incomplete charge event.",
        400,
      );
    return {
      eventId: `paystack.charge.success.${value.data.id}`,
      reference: value.data.reference,
      status: "success",
    };
  }
  async refund(): Promise<never> {
    throw new DomainError(
      "REFUND_NOT_IMPLEMENTED",
      "Refund integration is a separate payment stage.",
      501,
    );
  }
}
