import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { and, eq, lte, or } from "drizzle-orm";
import { DATABASE, Database } from "../../database/database.module";
import { emailOutbox } from "../../database/schema";
import { DomainError } from "../../common/errors/domain.error";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}
export class EmailDeliveryError extends Error {
  constructor(
    public readonly code: string,
    public readonly retryable: boolean,
  ) {
    super(code);
  }
}

@Injectable()
export class EmailService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private logger = new Logger(EmailService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<void>;
  constructor(
    @Inject(DATABASE) private db: Database,
    private config: ConfigService,
  ) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get("RESEND_API_KEY") &&
      this.config.get("EMAIL_FROM") &&
      /^[a-f\d]{64}$/i.test(this.config.get<string>("EMAIL_OUTBOX_KEY") ?? ""),
    );
  }
  requireConfigured(): void {
    if (!this.isConfigured())
      throw new DomainError(
        "EMAIL_DELIVERY_NOT_CONFIGURED",
        "Email delivery is not configured.",
        503,
      );
  }
  encrypt(message: EmailMessage): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(
      "aes-256-gcm",
      Buffer.from(this.config.getOrThrow<string>("EMAIL_OUTBOX_KEY"), "hex"),
      iv,
    );
    const payload = Buffer.concat([
      cipher.update(JSON.stringify(message), "utf8"),
      cipher.final(),
    ]);
    return Buffer.concat([iv, cipher.getAuthTag(), payload]).toString("base64");
  }
  decrypt(payload: string): EmailMessage {
    const data = Buffer.from(payload, "base64");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      Buffer.from(this.config.getOrThrow<string>("EMAIL_OUTBOX_KEY"), "hex"),
      data.subarray(0, 12),
    );
    decipher.setAuthTag(data.subarray(12, 28));
    return JSON.parse(
      Buffer.concat([
        decipher.update(data.subarray(28)),
        decipher.final(),
      ]).toString("utf8"),
    ) as EmailMessage;
  }
  async deliver(
    message: EmailMessage,
    idempotencyKey: string,
  ): Promise<string> {
    this.requireConfigured();
    let response: Response;
    try {
      response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        signal: AbortSignal.timeout(10000),
        headers: {
          Authorization: `Bearer ${this.config.getOrThrow("RESEND_API_KEY")}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          from: this.config.getOrThrow("EMAIL_FROM"),
          to: [message.to],
          subject: message.subject,
          text: message.text,
        }),
      });
    } catch {
      throw new EmailDeliveryError("EMAIL_NETWORK_ERROR", true);
    }
    if (!response.ok)
      throw new EmailDeliveryError(
        `EMAIL_PROVIDER_${response.status}`,
        response.status === 429 || response.status >= 500,
      );
    let result: { id?: string };
    try {
      result = (await response.json()) as { id?: string };
    } catch {
      throw new EmailDeliveryError("EMAIL_INVALID_RESPONSE", true);
    }
    if (typeof result?.id !== "string" || !result.id)
      throw new EmailDeliveryError("EMAIL_INVALID_RESPONSE", true);
    return result.id;
  }
  onApplicationBootstrap(): void {
    if (!this.isConfigured() || this.config.get("NODE_ENV") === "test") return;
    this.timer = setInterval(() => {
      if (!this.running)
        this.running = this.processNext()
          .catch(() =>
            this.logger.error(
              "Email worker failed; pending messages will be retried.",
            ),
          )
          .finally(() => {
            this.running = undefined;
          });
    }, 2000);
    this.timer.unref();
  }
  async onApplicationShutdown(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }

  async processNext(): Promise<void> {
    if (!this.isConfigured()) return;
    const now = new Date();
    // Leases and SKIP LOCKED allow multiple app instances without concurrent sends.
    const claimed = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(emailOutbox)
        .where(
          and(
            lte(emailOutbox.nextAttemptAt, now),
            or(
              eq(emailOutbox.status, "pending"),
              and(
                eq(emailOutbox.status, "sending"),
                lte(emailOutbox.leaseUntil, now),
              ),
            ),
          ),
        )
        .limit(1)
        .for("update", { skipLocked: true });
      if (!row) return;
      if (row.expiresAt <= now || row.attempts >= 5) {
        await tx
          .update(emailOutbox)
          .set({
            status: "failed",
            payloadCiphertext: null,
            leaseUntil: null,
            lastErrorCode:
              row.expiresAt <= now ? "EMAIL_EXPIRED" : "EMAIL_RETRY_LIMIT",
          })
          .where(eq(emailOutbox.id, row.id));
        return;
      }
      const leaseUntil = new Date(now.getTime() + 60000);
      await tx
        .update(emailOutbox)
        .set({ status: "sending", attempts: row.attempts + 1, leaseUntil })
        .where(eq(emailOutbox.id, row.id));
      return { ...row, leaseUntil, attempts: row.attempts + 1 };
    });
    if (!claimed) return;
    const ownedLease = and(
      eq(emailOutbox.id, claimed.id),
      eq(emailOutbox.status, "sending"),
      eq(emailOutbox.leaseUntil, claimed.leaseUntil),
    );
    try {
      const messageId = await this.deliver(
        this.decrypt(claimed.payloadCiphertext!),
        claimed.idempotencyKey,
      );
      await this.db
        .update(emailOutbox)
        .set({
          status: "sent",
          payloadCiphertext: null,
          leaseUntil: null,
          providerMessageId: messageId,
          lastErrorCode: null,
        })
        .where(ownedLease);
    } catch (error) {
      const retry =
        error instanceof EmailDeliveryError &&
        error.retryable &&
        claimed.attempts < 5;
      await this.db
        .update(emailOutbox)
        .set({
          status: retry ? "pending" : "failed",
          payloadCiphertext: retry ? claimed.payloadCiphertext : null,
          leaseUntil: null,
          nextAttemptAt: new Date(Date.now() + 1000 * 2 ** claimed.attempts),
          lastErrorCode:
            error instanceof EmailDeliveryError
              ? error.code
              : "EMAIL_PAYLOAD_INVALID",
        })
        .where(ownedLease);
      this.logger.warn(
        { outboxId: claimed.id, retry },
        "Email delivery attempt failed.",
      );
    }
  }
}
