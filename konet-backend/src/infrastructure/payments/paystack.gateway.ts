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
  private async call(path: string, body?: unknown, envelope = false) {
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
    if (envelope) return result;
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
      feeMinor: Number.isSafeInteger(data.fees) && data.fees >= 0 ? data.fees : null,
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
    if (
      ["transfer.success", "transfer.failed", "transfer.reversed"].includes(
        value.event,
      )
    ) {
      if (
        typeof value.data?.reference !== "string" ||
        !Number.isSafeInteger(value.data?.id)
      )
        throw new DomainError(
          "INVALID_WEBHOOK_PAYLOAD",
          "Incomplete transfer event.",
          400,
        );
      return {
        eventId: `paystack.${value.event}.${value.data.id}`,
        reference: value.data.reference,
        status: "settlement",
        kind: "transfer" as const,
      };
    }
    if (
      [
        "refund.processed",
        "refund.failed",
        "refund.pending",
        "refund.processing",
      ].includes(value.event)
    ) {
      if (!Number.isSafeInteger(value.data?.id))
        throw new DomainError(
          "INVALID_WEBHOOK_PAYLOAD",
          "Missing refund identity.",
          400,
        );
      return {
        eventId: `paystack.${value.event}.${value.data.id}`,
        reference: String(value.data.id),
        status: "settlement",
        kind: "refund" as const,
      };
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
  private bankCache?: {
    expiresAt: number;
    rows: { code: string; name: string }[];
  };
  async listBanks(): Promise<{ code: string; name: string }[]> {
    if (this.bankCache && this.bankCache.expiresAt > Date.now())
      return this.bankCache.rows;
    const banks = new Map<string, { code: string; name: string }>();
    const seen = new Set<string>();
    let cursor: string | undefined;
    for (let page = 0; page < 20; page++) {
      const query = new URLSearchParams({
        country: "nigeria",
        currency: "NGN",
        use_cursor: "true",
        perPage: "100",
      });
      if (cursor) query.set("next", cursor);
      const result = await this.call(
        `/bank?${query.toString()}`,
        undefined,
        true,
      );
      if (!Array.isArray(result.data))
        throw new DomainError(
          "PAYMENT_PROVIDER_MISMATCH",
          "Invalid bank list.",
          502,
        );
      for (const bank of result.data)
        if (
          bank.active === true &&
          bank.is_deleted !== true &&
          bank.currency === "NGN" &&
          bank.type === "nuban" &&
          typeof bank.code === "string" &&
          typeof bank.name === "string"
        )
          banks.set(bank.code, { code: bank.code, name: bank.name });
      const next = result.meta?.next;
      if (!next) {
        const rows = [...banks.values()].sort((a, b) =>
          a.name.localeCompare(b.name),
        );
        this.bankCache = { expiresAt: Date.now() + 3600000, rows };
        return rows;
      }
      if (typeof next !== "string" || seen.has(next))
        throw new DomainError(
          "PAYMENT_PROVIDER_MISMATCH",
          "Invalid bank pagination.",
          502,
        );
      seen.add(next);
      cursor = next;
    }
    throw new DomainError(
      "PAYMENT_PROVIDER_MISMATCH",
      "Bank pagination exceeded the supported limit.",
      502,
    );
  }
  async resolveRecipient(bankCode: string, accountNumber: string) {
    const account = await this.call(
      `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
    );
    if (
      account.account_number !== accountNumber ||
      typeof account.account_name !== "string" ||
      !account.account_name.trim()
    )
      throw new DomainError(
        "BANK_ACCOUNT_INVALID",
        "Paystack did not resolve this bank account.",
        422,
      );
    const recipient = await this.call("/transferrecipient", {
      type: "nuban",
      name: account.account_name,
      account_number: accountNumber,
      bank_code: bankCode,
      currency: "NGN",
    });
    if (
      recipient.active !== true ||
      recipient.currency !== "NGN" ||
      recipient.details?.account_number !== accountNumber ||
      recipient.details?.bank_code !== bankCode ||
      typeof recipient.recipient_code !== "string"
    )
      throw new DomainError(
        "PAYMENT_PROVIDER_MISMATCH",
        "Recipient does not match the bank account.",
        502,
      );
    return {
      accountName: account.account_name,
      recipientCode: recipient.recipient_code,
    };
  }
  async transfer(input: {
    reference: string;
    recipientCode: string;
    amountMinor: number;
  }) {
    const data = await this.call("/transfer", {
      source: "balance",
      reference: input.reference,
      recipient: input.recipientCode,
      amount: input.amountMinor,
      currency: "NGN",
      reason: "Client-approved Konet job payout",
    });
    if (data.reference !== input.reference)
      throw new DomainError(
        "PAYMENT_PROVIDER_MISMATCH",
        "Transfer reference mismatch.",
        502,
      );
    return { status: String(data.status) };
  }
  async verifyTransfer(reference: string) {
    const data = await this.call(
      `/transfer/verify/${encodeURIComponent(reference)}`,
    );
    if (
      typeof data.reference !== "string" ||
      !Number.isSafeInteger(data.amount) ||
      typeof data.currency !== "string" ||
      typeof data.status !== "string" ||
      typeof data.recipient?.recipient_code !== "string"
    )
      throw new DomainError(
        "PAYMENT_PROVIDER_MISMATCH",
        "Incomplete transfer verification.",
        502,
      );
    return {
      reference: data.reference,
      amountMinor: data.amount,
      currency: data.currency,
      status: data.status,
      recipientCode: data.recipient.recipient_code,
    };
  }
  async createRefund(input: {
    reference: string;
    amountMinor: number;
    refundId: string;
  }) {
    const data = await this.call("/refund", {
      transaction: input.reference,
      amount: input.amountMinor,
      currency: "NGN",
      merchant_note: `konet-refund:${input.refundId}`,
    });
    if (!Number.isSafeInteger(data.id))
      throw new DomainError(
        "PAYMENT_PROVIDER_MISMATCH",
        "Missing refund identity.",
        502,
      );
    return { id: String(data.id) };
  }
  async verifyRefund(id: string) {
    const data = await this.call(`/refund/${encodeURIComponent(id)}`);
    const transactionId =
      typeof data.transaction === "object"
        ? data.transaction?.id
        : data.transaction;
    if (
      !Number.isSafeInteger(data.id) ||
      !Number.isSafeInteger(transactionId) ||
      !Number.isSafeInteger(data.amount) ||
      typeof data.currency !== "string" ||
      typeof data.status !== "string" ||
      typeof data.merchant_note !== "string"
    )
      throw new DomainError(
        "PAYMENT_PROVIDER_MISMATCH",
        "Incomplete refund verification.",
        502,
      );
    return {
      id: String(data.id),
      transactionId: String(transactionId),
      amountMinor: data.amount,
      currency: data.currency,
      status: data.status,
      merchantNote: data.merchant_note,
    };
  }
  async refund(): Promise<never> {
    throw new DomainError(
      "REFUND_QUEUE_REQUIRED",
      "Refunds must use the authorized durable refund queue.",
      409,
    );
  }
}
