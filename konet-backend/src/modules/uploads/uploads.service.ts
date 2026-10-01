import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, eq, gt, inArray, isNull, lte, ne } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { DATABASE, Database } from "../../database/database.module";
import { auditEvents, uploads, userRoles, users } from "../../database/schema";
import { DomainError } from "../../common/errors/domain.error";
import { UploadInput } from "../contracts/contract.dto";
import { CloudinaryGateway } from "./cloudinary.gateway";
@Injectable()
export class UploadsService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<void>;
  private logger = new Logger(UploadsService.name);
  constructor(
    @Inject(DATABASE) private db: Database,
    private gateway: CloudinaryGateway,
    private config: ConfigService,
  ) {}
  private publicUpload(row: typeof uploads.$inferSelect) {
    return {
      id: row.id,
      objectKey: row.objectKey,
      purpose: row.purpose,
      status: row.status,
      createdAt: row.createdAt,
      retainUntil: row.retainUntil,
    };
  }
  async ticket(userId: string, input: UploadInput) {
    this.gateway.requireConfigured();
    if (input.purpose !== "student_evidence")
      throw new DomainError(
        "UPLOAD_PURPOSE_NOT_IMPLEMENTED",
        "This feature currently accepts student_evidence only.",
        501,
      );
    return this.db.transaction(async (tx) => {
      const [user] = await tx
        .select({ status: users.accountStatus })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
        .for("update");
      if (!user || user.status !== "active")
        throw new DomainError(
          "ACCOUNT_UNAVAILABLE",
          "Account is unavailable.",
          403,
        );
      const recent = await tx
        .select({ id: uploads.id })
        .from(uploads)
        .where(
          and(
            eq(uploads.userId, userId),
            gt(uploads.createdAt, new Date(Date.now() - 86400000)),
          ),
        )
        .limit(20);
      if (recent.length >= 20)
        throw new DomainError(
          "UPLOAD_RATE_LIMIT",
          "Daily upload limit reached. Try again tomorrow.",
          429,
        );
      const existing = await tx
        .select({ id: uploads.id })
        .from(uploads)
        .where(
          and(
            eq(uploads.userId, userId),
            isNull(uploads.verificationId),
            inArray(uploads.status, ["pending", "scanning", "ready"]),
            gt(uploads.retainUntil, new Date()),
          ),
        )
        .limit(5);
      if (existing.length >= 5)
        throw new DomainError(
          "UPLOAD_LIMIT",
          "Remove an unused upload before creating another.",
          429,
        );
      const id = randomUUID();
      const objectKey = `konet/student-evidence/${userId}/${id}`;
      const [row] = await tx
        .insert(uploads)
        .values({
          id,
          userId,
          objectKey,
          purpose: input.purpose,
          contentType: input.contentType,
          expectedBytes: input.sizeBytes,
          expiresAt: new Date(Date.now() + 600000),
          retainUntil: new Date(Date.now() + 86400000),
        })
        .returning();
      return {
        upload: this.publicUpload(row),
        ...this.gateway.ticket(objectKey),
        expiresAt: row.expiresAt,
      };
    });
  }
  private async own(userId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(uploads)
      .where(
        and(
          eq(uploads.id, id),
          eq(uploads.userId, userId),
          ne(uploads.status, "deleted"),
          ne(uploads.status, "deleting"),
        ),
      )
      .limit(1);
    if (!row)
      throw new DomainError("UPLOAD_NOT_FOUND", "Upload not found.", 404);
    return row;
  }
  async get(userId: string, id: string) {
    return this.publicUpload(await this.own(userId, id));
  }
  async complete(userId: string, id: string) {
    const row = await this.own(userId, id);
    if (row.status === "ready" || row.status === "rejected")
      return this.publicUpload(row);
    if (row.status === "pending" && row.expiresAt <= new Date())
      throw new DomainError(
        "UPLOAD_TICKET_EXPIRED",
        "Request a new upload ticket.",
        409,
      );
    const asset = await this.gateway.inspect(row.objectKey);
    const formats: Record<string, string[]> = {
      "image/jpeg": ["jpg", "jpeg"],
      "image/png": ["png"],
      "application/pdf": ["pdf"],
    };
    const valid =
      asset.type === "authenticated" &&
      asset.resource_type === "image" &&
      asset.public_id === row.objectKey &&
      asset.bytes === row.expectedBytes &&
      asset.bytes <= 10485760 &&
      formats[row.contentType]?.includes(asset.format);
    const scan = asset.moderation?.find(
      (item) => item.kind === "perception_point",
    )?.status;
    const status =
      !valid || scan === "rejected"
        ? "rejected"
        : scan === "approved"
          ? "ready"
          : "scanning";
    const [changed] = await this.db
      .update(uploads)
      .set({ status, assetId: asset.asset_id, version: asset.version })
      .where(
        and(
          eq(uploads.id, row.id),
          inArray(uploads.status, ["pending", "scanning"]),
        ),
      )
      .returning();
    return this.publicUpload(changed ?? (await this.own(userId, id)));
  }
  async download(userId: string, id: string) {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(uploads)
        .where(eq(uploads.id, id))
        .limit(1)
        .for("update");
      if (!row || row.status !== "ready" || row.retainUntil <= new Date())
        throw new DomainError(
          "EVIDENCE_NOT_READY",
          "Scanned evidence is unavailable.",
          409,
        );
      if (row.userId !== userId) {
        const [role] = await tx
          .select({ role: userRoles.role })
          .from(userRoles)
          .where(
            and(
              eq(userRoles.userId, userId),
              inArray(userRoles.role, ["admin", "reviewer"]),
            ),
          )
          .limit(1);
        if (!role || !row.verificationId || row.purpose !== "student_evidence")
          throw new DomainError(
            "UPLOAD_FORBIDDEN",
            "Evidence access is restricted to its owner and authorized reviewers.",
            403,
          );
      }
      await tx.insert(auditEvents).values({
        actorId: userId,
        action: "verification_evidence.accessed",
        resourceType: "upload",
        resourceId: row.id,
        details: {},
      });
      const format =
        row.contentType === "application/pdf"
          ? "pdf"
          : row.contentType === "image/png"
            ? "png"
            : "jpg";
      return this.gateway.download(row.objectKey, format);
    });
  }
  async remove(userId: string, id: string) {
    await this.db.transaction(async (tx) => {
      await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
        .for("update");
      const [row] = await tx
        .select()
        .from(uploads)
        .where(and(eq(uploads.id, id), eq(uploads.userId, userId)))
        .limit(1)
        .for("update");
      if (!row)
        throw new DomainError("UPLOAD_NOT_FOUND", "Upload not found.", 404);
      if (row.verificationId)
        throw new DomainError(
          "EVIDENCE_ATTACHED",
          "Submitted evidence is retained according to the review policy.",
          409,
        );
      if (["deleted", "deleting"].includes(row.status)) return;
      await tx
        .update(uploads)
        .set({
          status: "deleting",
          retainUntil: new Date(
            Math.max(Date.now(), row.createdAt.getTime() + 3600000),
          ),
        })
        .where(eq(uploads.id, id));
      await tx.insert(auditEvents).values({
        actorId: userId,
        action: "upload.deletion_requested",
        resourceType: "upload",
        resourceId: id,
        details: {},
      });
    });
  }
  async purgeExpired(): Promise<void> {
    for (let count = 0; count < 10; count++) {
      const processed = await this.db.transaction(async (tx) => {
        const [row] = await tx
          .select()
          .from(uploads)
          .where(
            and(
              lte(uploads.retainUntil, new Date()),
              ne(uploads.status, "deleted"),
            ),
          )
          .limit(1)
          .for("update", { skipLocked: true });
        if (!row) return false;
        await this.gateway.destroy(row.objectKey);
        await tx
          .update(uploads)
          .set({ status: "deleted", assetId: null, version: null })
          .where(eq(uploads.id, row.id));
        await tx.insert(auditEvents).values({
          actorId: null,
          action: "verification_evidence.purged",
          resourceType: "upload",
          resourceId: row.id,
          details: { source: "retention_worker" },
        });
        return true;
      });
      if (!processed) return;
    }
  }
  onApplicationBootstrap(): void {
    if (!this.gateway.configured() || this.config.get("NODE_ENV") === "test")
      return;
    this.timer = setInterval(() => {
      if (!this.running)
        this.running = this.purgeExpired()
          .catch(() =>
            this.logger.error(
              "Evidence retention cleanup failed; it will retry.",
            ),
          )
          .finally(() => {
            this.running = undefined;
          });
    }, 60000);
    this.timer.unref();
  }
  async onApplicationShutdown(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }
}
