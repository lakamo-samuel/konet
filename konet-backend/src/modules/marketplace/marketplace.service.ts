import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DATABASE, Database } from "../../database/database.module";
import {
  disputes,
  jobs,
  payments,
  providerProfiles,
  reviews,
  services,
} from "../../database/schema";
import { DomainError } from "../../common/errors/domain.error";
import {
  CreateServiceDto,
  DisputeDto,
  ReviewDto,
  UpdateServiceDto,
} from "./dto";
import { ProviderOnboardingService } from "../providers/provider-onboarding.service";
@Injectable()
export class MarketplaceService {
  constructor(
    @Inject(DATABASE) private db: Database,
    private onboarding: ProviderOnboardingService,
  ) {}
  private async providerFor(userId: string) {
    const [p] = await this.db
      .select()
      .from(providerProfiles)
      .where(eq(providerProfiles.userId, userId))
      .limit(1);
    if (!p)
      throw new DomainError(
        "PROVIDER_REQUIRED",
        "A provider profile is required.",
        403,
      );
    return p;
  }
  async createService(userId: string, d: CreateServiceDto) {
    return this.onboarding.createService(userId, d);
  }
  async myServices(userId: string) {
    const p = await this.providerFor(userId);
    return this.db.select().from(services).where(eq(services.providerId, p.id));
  }
  async updateService(userId: string, id: string, d: UpdateServiceDto) {
    return this.onboarding.updateService(userId, id, d);
  }
  async archiveService(userId: string, id: string) {
    return this.updateService(userId, id, { status: "archived" });
  }
  async review(userId: string, d: ReviewDto) {
    const [j] = await this.db
      .select()
      .from(jobs)
      .where(
        and(
          eq(jobs.id, d.jobId),
          eq(jobs.clientId, userId),
          eq(jobs.status, "completed"),
        ),
      )
      .limit(1);
    if (!j)
      throw new DomainError(
        "REVIEW_NOT_ALLOWED",
        "Only the client can review a completed job.",
        403,
      );
    try {
      const [r] = await this.db
        .insert(reviews)
        .values({ ...d, clientId: userId, providerId: j.providerId })
        .returning();
      return r;
    } catch {
      throw new DomainError(
        "REVIEW_EXISTS",
        "This job has already been reviewed.",
        409,
      );
    }
  }
  async dispute(userId: string, jobId: string, d: DisputeDto) {
    return this.db.transaction(async (tx) => {
      const [j] = await tx
        .select()
        .from(jobs)
        .where(eq(jobs.id, jobId))
        .limit(1);
      const p = await tx
        .select({ id: providerProfiles.id })
        .from(providerProfiles)
        .where(eq(providerProfiles.userId, userId))
        .limit(1);
      if (!j || (j.clientId !== userId && j.providerId !== p[0]?.id))
        throw new DomainError(
          "JOB_FORBIDDEN",
          "You cannot dispute this job.",
          403,
        );
      if (
        !["scheduled", "in_progress", "awaiting_client_confirmation"].includes(
          j.status,
        )
      )
        throw new DomainError(
          "DISPUTE_NOT_ALLOWED",
          "This job cannot be disputed in its current state.",
          409,
        );
      const [dsp] = await tx
        .insert(disputes)
        .values({ jobId, openedByUserId: userId, ...d })
        .returning();
      await tx
        .update(jobs)
        .set({ status: "disputed", updatedAt: new Date() })
        .where(eq(jobs.id, jobId));
      await tx
        .update(payments)
        .set({ status: "disputed", updatedAt: new Date() })
        .where(eq(payments.jobId, jobId));
      return dsp;
    });
  }
}
