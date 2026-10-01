import { ConfigService } from "@nestjs/config";
import type { Database } from "../src/database/database.module";
import { EmailService } from "../src/infrastructure/email/email.service";

const message = {
  to: "student@example.com",
  subject: "Reset your Konet password",
  text: "Private reset token",
};
describe("transactional email adapter", () => {
  const config = new ConfigService({
    RESEND_API_KEY: "fake-key",
    EMAIL_FROM: "support@example.com",
    EMAIL_OUTBOX_KEY: "ab".repeat(32),
  });
  const email = new EmailService({} as Database, config);
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });
  it("encrypts sensitive payloads with authenticated encryption", () => {
    const encrypted = email.encrypt(message);
    expect(encrypted).not.toContain(message.text);
    expect(email.decrypt(encrypted)).toEqual(message);
    const bytes = Buffer.from(encrypted, "base64");
    bytes[bytes.length - 1] ^= 1;
    expect(() => email.decrypt(bytes.toString("base64"))).toThrow();
  });
  it("sends plain-text reset email with timeout and stable idempotency key", async () => {
    const mocked = jest
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "email-id" }), { status: 200 }),
      );
    global.fetch = mocked;
    await expect(
      email.deliver(message, "password-reset:request-id"),
    ).resolves.toBe("email-id");
    const [url, options] = mocked.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(options.headers["Idempotency-Key"]).toBe(
      "password-reset:request-id",
    );
    expect(JSON.parse(options.body)).toEqual({
      from: "support@example.com",
      to: [message.to],
      subject: message.subject,
      text: message.text,
    });
    expect(options.signal).toBeDefined();
  });
  it.each([
    [429, true],
    [503, true],
    [401, false],
    [422, false],
  ])("classifies provider status %i correctly", async (status, retryable) => {
    global.fetch = jest.fn().mockResolvedValue(new Response("", { status }));
    await expect(email.deliver(message, "key")).rejects.toMatchObject({
      code: `EMAIL_PROVIDER_${status}`,
      retryable,
    });
  });
  it("retries a malformed provider response using the same idempotency key", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(new Response("not-json", { status: 200 }));
    await expect(email.deliver(message, "key")).rejects.toMatchObject({
      code: "EMAIL_INVALID_RESPONSE",
      retryable: true,
    });
  });
  it("fails visibly when delivery is unconfigured", async () => {
    const unconfigured = new EmailService(
      {} as Database,
      new ConfigService({}),
    );
    await expect(unconfigured.deliver(message, "key")).rejects.toMatchObject({
      code: "EMAIL_DELIVERY_NOT_CONFIGURED",
      statusCode: 503,
    });
  });
});
