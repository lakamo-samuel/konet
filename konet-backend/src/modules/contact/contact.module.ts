import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Injectable,
  Module,
  Post,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { ConfigService } from "@nestjs/config";
import { and, eq, gte, sql } from "drizzle-orm";
import { DATABASE, Database } from "../../database/database.module";
import { contactMessages, emailOutbox } from "../../database/schema";
import { EmailService } from "../../infrastructure/email/email.service";
import { EmailModule } from "../../infrastructure/email/email.module";
import { DomainError } from "../../common/errors/domain.error";
import { ContactInput } from "../contracts/contract.dto";
@Injectable()
export class ContactService {
  constructor(
    @Inject(DATABASE) private db: Database,
    private config: ConfigService,
    private email: EmailService,
  ) {}
  async submit(input: ContactInput) {
    this.email.requireConfigured();
    const recipient = this.config.get<string>("SUPPORT_EMAIL");
    if (!recipient)
      throw new DomainError(
        "SUPPORT_EMAIL_NOT_CONFIGURED",
        "Support email is not configured.",
        503,
      );
    const address = input.email.trim().toLowerCase();
    const topic = input.topic.trim();
    const message = input.message.trim();
    if (
      topic.length < 3 ||
      topic.length > 100 ||
      message.length < 10 ||
      message.length > 5000
    )
      throw new DomainError(
        "INVALID_CONTACT_MESSAGE",
        "Topic must be 3–100 characters; message must be 10–5000 characters.",
        422,
      );
    await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${`contact:${address}`}))`,
      );
      const recent = await tx
        .select({ id: contactMessages.id })
        .from(contactMessages)
        .where(
          and(
            eq(contactMessages.email, address),
            gte(contactMessages.createdAt, new Date(Date.now() - 3600000)),
          ),
        )
        .limit(3);
      if (recent.length >= 3)
        throw new DomainError(
          "CONTACT_RATE_LIMIT",
          "At most three contact messages are allowed per email per hour.",
          429,
        );
      const [ticket] = await tx
        .insert(contactMessages)
        .values({ email: address, topic, message })
        .returning();
      await tx
        .insert(emailOutbox)
        .values({
          userId: null,
          idempotencyKey: `contact:${ticket.id}`,
          expiresAt: new Date(Date.now() + 86400000),
          payloadCiphertext: this.email.encrypt({
            to: recipient,
            subject: "New Konet support request",
            text: `Support request: ${ticket.id}\nSubmitted email (unverified): ${address}\nTopic: ${topic}\n\n${message}`,
          }),
        });
    });
    return {
      message:
        "Your support message has been saved and queued for the support team.",
    };
  }
}
@ApiTags("contact")
@Controller({ version: "1" })
export class ContactController {
  constructor(private service: ContactService) {}
  @Post("contact")
  @HttpCode(202)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  submit(@Body() input: ContactInput) {
    return this.service.submit(input);
  }
}
@Module({
  imports: [EmailModule],
  controllers: [ContactController],
  providers: [ContactService],
})
export class ContactModule {}
