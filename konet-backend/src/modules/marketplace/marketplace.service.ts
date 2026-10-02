import { Inject, Injectable } from "@nestjs/common";
import { DisputeService } from "./dispute.service";
import { and, eq } from "drizzle-orm";
import { DATABASE, Database } from "../../database/database.module";
import {
  jobs,
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
    private disputes: DisputeService,
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
    return this.disputes.open(userId, jobId, d);
  }
}
