import "reflect-metadata";
import { validateEnvironment } from "../src/config/env";
import { ConfigService } from "@nestjs/config";
import { createHmac } from "node:crypto";
import { PaystackGateway } from "../src/infrastructure/payments/paystack.gateway";
describe("Paystack gateway", () => {
  const secret = "sk_test_unitsecret";
  const gateway = new PaystackGateway(
    new ConfigService({ PAYSTACK_SECRET_KEY: secret }),
  );
  it("requires HTTPS for production payment callbacks and allows empty optional placeholders", () => {
    const base = {
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://test.invalid/test",
      JWT_ACCESS_SECRET: "a".repeat(32),
      JWT_REFRESH_SECRET: "b".repeat(32),
      FRONTEND_URL: "http://localhost:3000",
      PAYSTACK_SECRET_KEY: secret,
    };
    expect(() => validateEnvironment(base)).toThrow(
      "Production payment callback must use HTTPS",
    );
    expect(() =>
      validateEnvironment({
        ...base,
        PAYMENT_CALLBACK_URL: "https://konet.example/payment-result",
      }),
    ).not.toThrow();
    expect(() =>
      validateEnvironment({
        ...base,
        PAYSTACK_SECRET_KEY: "",
        PAYMENT_CALLBACK_URL: "",
      }),
    ).not.toThrow();
  });
  afterEach(() => jest.restoreAllMocks());
  const respond = (data: unknown, status = true) =>
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ status, data }), { status: 200 }),
      );
  it("fails closed without credentials and makes no request", async () => {
    const fetch = jest.spyOn(global, "fetch");
    await expect(
      new PaystackGateway(new ConfigService({})).verify("reference"),
    ).rejects.toMatchObject({ code: "PAYMENT_GATEWAY_NOT_CONFIGURED" });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("sends server-owned amount, reference, email and metadata to hosted checkout", async () => {
    const fetch = respond({
      reference: "konet-payment",
      authorization_url: "https://checkout.paystack.com/example",
    });
    const result = await gateway.initialize({
      paymentId: "payment",
      reference: "konet-payment",
      email: "client@example.com",
      amountMinor: 500000,
      currency: "NGN",
      callbackUrl: "https://konet.example/payment-result",
    });
    expect(result.reference).toBe("konet-payment");
    const options = fetch.mock.calls[0][1]!;
    const body = JSON.parse(options.body as string);
    expect(body).toMatchObject({
      amount: "500000",
      currency: "NGN",
      reference: "konet-payment",
      email: "client@example.com",
      metadata: JSON.stringify({ paymentId: "payment" }),
    });
    expect(body).not.toHaveProperty("split_code");
  });
  it("rejects an unrelated reference or unsafe checkout destination", async () => {
    respond({
      reference: "wrong",
      authorization_url: "https://checkout.paystack.com/example",
    });
    const input = {
      paymentId: "payment",
      reference: "konet-payment",
      email: "client@example.com",
      amountMinor: 500000,
      currency: "NGN",
      callbackUrl: "https://konet.example/payment-result",
    };
    await expect(gateway.initialize(input)).rejects.toMatchObject({
      code: "PAYMENT_PROVIDER_MISMATCH",
    });
    jest.restoreAllMocks();
    respond({
      reference: input.reference,
      authorization_url: "https://evil.invalid/payment",
    });
    await expect(gateway.initialize(input)).rejects.toMatchObject({
      code: "PAYMENT_PROVIDER_MISMATCH",
    });
  });
  it("extracts verification evidence and rejects incomplete provider responses", async () => {
    respond({
      id: 123,
      reference: "ref",
      status: "success",
      amount: 500000,
      currency: "NGN",
      customer: { email: "client@example.com" },
      metadata: { paymentId: "payment" },
    });
    expect(await gateway.verify("ref")).toMatchObject({
      transactionId: "123",
      amountMinor: 500000,
      paymentId: "payment",
    });
    jest.restoreAllMocks();
    respond({ id: 123, reference: "ref", status: "success", amount: "500000" });
    await expect(gateway.verify("ref")).rejects.toMatchObject({
      code: "PAYMENT_PROVIDER_MISMATCH",
    });
  });
  it("verifies signature against exact raw bytes before parsing", async () => {
    const raw = Buffer.from(
      '{"event":"charge.success","data":{"id":123,"reference":"ref"}}',
    );
    const signature = createHmac("sha512", secret).update(raw).digest("hex");
    expect(await gateway.verifyWebhook(signature, raw)).toEqual({
      eventId: "paystack.charge.success.123",
      reference: "ref",
      status: "success",
    });
    await expect(
      gateway.verifyWebhook(signature, Buffer.concat([raw, Buffer.from(" ")])),
    ).rejects.toMatchObject({ code: "INVALID_WEBHOOK_SIGNATURE" });
    await expect(
      gateway.verifyWebhook("bad", Buffer.from("not-json")),
    ).rejects.toMatchObject({ code: "INVALID_WEBHOOK_SIGNATURE" });
  });
  it("ignores signed unrelated event types", async () => {
    const raw = Buffer.from('{"event":"unrelated.event"}');
    const signature = createHmac("sha512", secret).update(raw).digest("hex");
    expect((await gateway.verifyWebhook(signature, raw)).status).toBe(
      "ignored",
    );
  });
  it("follows bank pagination, excludes inactive banks and caches the result", async () => {
    const first = {
      code: "058",
      name: "First Bank",
      active: true,
      is_deleted: false,
      currency: "NGN",
      type: "nuban",
    };
    const fetch = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: true,
            data: [first],
            meta: { next: "second-page" },
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: true,
            data: [
              { ...first, code: "044", name: "Second Bank" },
              { ...first, code: "000", active: false },
            ],
            meta: { next: null },
          }),
        ),
      );
    const fresh = new PaystackGateway(
      new ConfigService({ PAYSTACK_SECRET_KEY: secret }),
    );
    expect(await fresh.listBanks()).toHaveLength(2);
    expect(fetch.mock.calls[1][0]).toContain("next=second-page");
    await fresh.listBanks();
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("resolves a bank account and registers only its matching active NGN recipient", async () => {
    const fetch = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: true,
            data: {
              account_number: "0123456789",
              account_name: "Bank Verified Name",
            },
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: true,
            data: {
              active: true,
              currency: "NGN",
              recipient_code: "RCP_bank",
              details: { account_number: "0123456789", bank_code: "058" },
            },
          }),
        ),
      );
    expect(await gateway.resolveRecipient("058", "0123456789")).toEqual({
      accountName: "Bank Verified Name",
      recipientCode: "RCP_bank",
    });
    expect(JSON.parse(fetch.mock.calls[1][1]!.body as string)).toMatchObject({
      type: "nuban",
      name: "Bank Verified Name",
      bank_code: "058",
      account_number: "0123456789",
    });
  });
  it("initiates a stable transfer reference and extracts server-verified settlement evidence", async () => {
    const fetch = respond({
      reference: "konet-payout-reference",
      status: "pending",
    });
    await gateway.transfer({
      reference: "konet-payout-reference",
      recipientCode: "RCP_bank",
      amountMinor: 500000,
    });
    expect(JSON.parse(fetch.mock.calls[0][1]!.body as string)).toMatchObject({
      source: "balance",
      amount: 500000,
      reference: "konet-payout-reference",
      recipient: "RCP_bank",
    });
    jest.restoreAllMocks();
    respond({
      reference: "konet-payout-reference",
      amount: 500000,
      currency: "NGN",
      status: "success",
      recipient: { recipient_code: "RCP_bank" },
    });
    expect(
      (await gateway.verifyTransfer("konet-payout-reference")).recipientCode,
    ).toBe("RCP_bank");
  });
  it("correlates full refunds with the local authorization rather than claiming create is success", async () => {
    const fetch = respond({ id: 987654 });
    expect(
      await gateway.createRefund({
        reference: "charge-ref",
        amountMinor: 500000,
        refundId: "local-refund",
      }),
    ).toEqual({ id: "987654" });
    expect(JSON.parse(fetch.mock.calls[0][1]!.body as string)).toMatchObject({
      transaction: "charge-ref",
      amount: 500000,
      merchant_note: "konet-refund:local-refund",
    });
    jest.restoreAllMocks();
    respond({
      id: 987654,
      transaction: 123456,
      amount: 500000,
      currency: "NGN",
      status: "processed",
      merchant_note: "konet-refund:local-refund",
    });
    expect(await gateway.verifyRefund("987654")).toMatchObject({
      transactionId: "123456",
      status: "processed",
      merchantNote: "konet-refund:local-refund",
    });
  });
  it("returns a safe provider error after network or API failures", async () => {
    jest
      .spyOn(global, "fetch")
      .mockRejectedValue(new Error("Provider internals and secrets"));
    await expect(gateway.verify("ref")).rejects.toMatchObject({
      code: "PAYMENT_PROVIDER_UNAVAILABLE",
      statusCode: 503,
    });
  });
});
