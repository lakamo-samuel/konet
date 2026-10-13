import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { PartialType } from "@nestjs/swagger";
import { and, desc, eq, gt, inArray, isNull } from "drizzle-orm";
import { visibleCategory } from "../catalog/catalog-visibility";
import { DomainError } from "../../common/errors/domain.error";
import { DATABASE, Database } from "../../database/database.module";
import {
  auditEvents,
  campuses,
  notifications,
  portfolioItems,
  providerEvidenceSubmissions,
  providerOnboardingSteps,
  providerProfiles,
  providerReviewDecisions,
  providerVerifications,
  serviceCategories,
  services,
  universities,
  uploads,
  users,
} from "../../database/schema";
import {
  ProviderEvidenceDecisionInput,
  ListQuery,
  OnboardingStepInput,
  PortfolioInput,
  PortfolioUpdateInput,
  ProviderDecisionInput,
  ProviderEvidenceInput,
  ProviderInput,
  ProviderUpdateInput,
} from "../contracts/contract.dto";
import { CreateServiceDto, UpdateServiceDto } from "../marketplace/dto";
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Profile = typeof providerProfiles.$inferSelect;
class ServiceDraft extends PartialType(CreateServiceDto) {}
class EvidenceDraft extends PartialType(ProviderEvidenceInput) {}
@Injectable()
export class ProviderOnboardingService {
  constructor(
    @Inject(DATABASE) private db: Database,
    private config: ConfigService,
  ) {}
  private requiredDimensions = ["identity", "work"];
  private async lockUser(tx: Tx, userId: string, requireVerified = true) {
    const [user] = await tx
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .for("update");
    if (!user || user.accountStatus !== "active")
      throw new DomainError(
        "ACCOUNT_UNAVAILABLE",
        "Account is unavailable.",
        403,
      );
    if (requireVerified && user.studentVerificationStatus !== "verified")
      throw new DomainError(
        "STUDENT_VERIFICATION_REQUIRED",
        "Verify student status before provider onboarding.",
        403,
      );
    if (requireVerified) {
      const [campus] = await tx
        .select({ id: campuses.id })
        .from(campuses)
        .innerJoin(universities, eq(campuses.universityId, universities.id))
        .where(
          and(
            eq(campuses.id, user.campusId),
            eq(campuses.universityId, user.universityId),
            eq(campuses.isActive, true),
            eq(universities.isActive, true),
          ),
        )
        .limit(1);
      if (!campus)
        throw new DomainError(
          "UNIVERSITY_UNAVAILABLE",
          "An active university and campus are required.",
          409,
        );
    }
    return user;
  }
  private async profile(tx: Tx, userId: string) {
    const [row] = await tx
      .select()
      .from(providerProfiles)
      .where(eq(providerProfiles.userId, userId))
      .limit(1)
      .for("update");
    if (!row)
      throw new DomainError(
        "PROVIDER_PROFILE_REQUIRED",
        "Create a provider draft first.",
        404,
      );
    return row;
  }
  private editable(row: Profile) {
    if (row.status === "suspended")
      throw new DomainError(
        "PROVIDER_SUSPENDED",
        "Suspended profiles cannot be changed or published.",
        403,
      );
    if (row.reviewStatus === "pending" || row.status === "pending_verification")
      throw new DomainError(
        "PROVIDER_REVIEW_PENDING",
        "Wait for the pending profile review before changing this submission.",
        409,
      );
  }
  private async audit(
    tx: Tx,
    actorId: string | null,
    action: string,
    resourceType: string,
    resourceId: string,
    details: Record<string, unknown> = {},
    reason?: string,
  ) {
    await tx
      .insert(auditEvents)
      .values({ actorId, action, resourceType, resourceId, details, reason });
  }
  private async clearApproval(tx: Tx, row: Profile) {
    await tx
      .update(providerProfiles)
      .set({
        status: "draft",
        reviewStatus: "not_submitted",
        approvedAt: null,
        reviewedAt: null,
        reviewReason: null,
        updatedAt: new Date(),
      })
      .where(eq(providerProfiles.id, row.id));
  }
  async create(userId: string, input: ProviderInput) {
    if (
      input.professionalTitle.trim().length < 3 ||
      input.bio.trim().length < 40
    )
      throw new DomainError(
        "INVALID_PROVIDER_PROFILE",
        "Provide a real title and a bio of at least 40 characters.",
        400,
      );
    this.validatePublicUrl(input.coverImageUrl);
    return this.db.transaction(async (tx) => {
      await this.lockUser(tx, userId);
      const [existing] = await tx
        .select({ id: providerProfiles.id })
        .from(providerProfiles)
        .where(eq(providerProfiles.userId, userId))
        .limit(1);
      if (existing)
        throw new DomainError(
          "PROVIDER_PROFILE_EXISTS",
          "This account already has a provider profile.",
          409,
        );
      const [row] = await tx
        .insert(providerProfiles)
        .values({
          userId,
          ...input,
          professionalTitle: input.professionalTitle.trim(),
          bio: input.bio.trim(),
        })
        .returning();
      await tx.insert(providerVerifications).values(
        ["identity", "work", "cac"].map((dimension) => ({
          providerId: row.id,
          dimension,
        })),
      );
      await this.audit(
        tx,
        userId,
        "provider_profile.created",
        "provider",
        row.id,
      );
      return row;
    });
  }
  async own(userId: string) {
    const [row] = await this.db
      .select()
      .from(providerProfiles)
      .where(eq(providerProfiles.userId, userId))
      .limit(1);
    if (!row)
      throw new DomainError(
        "PROVIDER_PROFILE_REQUIRED",
        "Create a provider draft first.",
        404,
      );
    return row;
  }
  async update(userId: string, input: ProviderUpdateInput) {
    if (
      (input.professionalTitle !== undefined &&
        input.professionalTitle.trim().length < 3) ||
      (input.bio !== undefined && input.bio.trim().length < 40)
    )
      throw new DomainError(
        "INVALID_PROVIDER_PROFILE",
        "Provide meaningful profile text.",
        400,
      );
    this.validatePublicUrl(input.coverImageUrl);
    if (Object.values(input).every((v) => v === undefined))
      throw new DomainError(
        "EMPTY_UPDATE",
        "Provide at least one profile field.",
        400,
      );
    return this.db.transaction(async (tx) => {
      await this.lockUser(tx, userId);
      const row = await this.profile(tx, userId);
      this.editable(row);
      const substantive =
        input.professionalTitle !== undefined ||
        input.bio !== undefined ||
        input.coverImageUrl !== undefined;
      if (substantive) await this.clearApproval(tx, row);
      const [updated] = await tx
        .update(providerProfiles)
        .set({
          ...input,
          availability: input.availability as Profile["availability"],
          updatedAt: new Date(),
        })
        .where(eq(providerProfiles.id, row.id))
        .returning();
      await this.audit(
        tx,
        userId,
        "provider_profile.updated",
        "provider",
        row.id,
        { approvalInvalidated: substantive },
      );
      return updated;
    });
  }
  private dimensionView(
    row: typeof providerVerifications.$inferSelect,
    uploadId: string | null = null,
  ) {
    return {
      id: row.id,
      providerId: row.providerId,
      dimension: row.dimension,
      status: row.status,
      revision: row.revision,
      reason: row.reason,
      submittedAt: row.submittedAt,
      decidedAt: row.decidedAt,
      createdAt: row.createdAt,
      uploadId,
    };
  }
  async dimensions(providerId: string) {
    const rows = await this.db
      .select({
        row: providerVerifications,
        uploadId: providerEvidenceSubmissions.uploadId,
      })
      .from(providerVerifications)
      .leftJoin(
        providerEvidenceSubmissions,
        and(
          eq(
            providerEvidenceSubmissions.verificationId,
            providerVerifications.id,
          ),
          eq(
            providerEvidenceSubmissions.revision,
            providerVerifications.revision,
          ),
        ),
      )
      .where(eq(providerVerifications.providerId, providerId))
      .orderBy(providerVerifications.dimension);
    return rows.map((r) => this.dimensionView(r.row, r.uploadId));
  }
  async ownDimensions(userId: string) {
    return this.dimensions((await this.own(userId)).id);
  }
  async submitEvidence(userId: string, input: ProviderEvidenceInput) {
    return this.db.transaction(async (tx) => {
      await this.lockUser(tx, userId);
      const profile = await this.profile(tx, userId);
      this.editable(profile);
      const [dimension] = await tx
        .select()
        .from(providerVerifications)
        .where(
          and(
            eq(providerVerifications.providerId, profile.id),
            eq(providerVerifications.dimension, input.dimension),
          ),
        )
        .limit(1)
        .for("update");
      if (!dimension)
        throw new DomainError(
          "VERIFICATION_DIMENSION_NOT_FOUND",
          "Verification dimension not found.",
          404,
        );
      if (dimension.status === "pending")
        throw new DomainError(
          "VERIFICATION_PENDING",
          "This evidence is already awaiting review.",
          409,
        );
      if (dimension.status === "verified")
        throw new DomainError(
          "VERIFICATION_ALREADY_APPROVED",
          "This dimension has already been approved.",
          409,
        );
      const recent = await tx
        .select({ id: providerEvidenceSubmissions.id })
        .from(providerEvidenceSubmissions)
        .where(
          and(
            eq(providerEvidenceSubmissions.verificationId, dimension.id),
            gt(
              providerEvidenceSubmissions.submittedAt,
              new Date(Date.now() - 86400000),
            ),
          ),
        )
        .limit(3);
      if (recent.length >= 3)
        throw new DomainError(
          "VERIFICATION_RATE_LIMIT",
          "Daily evidence submission limit reached.",
          429,
        );
      const [evidence] = await tx
        .select()
        .from(uploads)
        .where(
          and(
            eq(uploads.objectKey, input.evidenceObjectKey),
            eq(uploads.userId, userId),
            eq(uploads.purpose, "provider_evidence"),
            eq(uploads.status, "ready"),
            isNull(uploads.verificationId),
            isNull(uploads.providerVerificationId),
            gt(uploads.retainUntil, new Date()),
          ),
        )
        .limit(1)
        .for("update");
      if (!evidence)
        throw new DomainError(
          "EVIDENCE_NOT_READY",
          "Use your own ready, unused provider evidence upload.",
          409,
        );
      const now = new Date();
      const [updated] = await tx
        .update(providerVerifications)
        .set({
          status: "pending",
          revision: dimension.revision + 1,
          evidenceObjectKey: evidence.objectKey,
          submittedAt: now,
          decidedAt: null,
          reason: null,
        })
        .where(eq(providerVerifications.id, dimension.id))
        .returning();
      await tx.insert(providerEvidenceSubmissions).values({
        verificationId: dimension.id,
        revision: updated.revision,
        uploadId: evidence.id,
      });
      await tx
        .update(uploads)
        .set({
          providerVerificationId: dimension.id,
          retainUntil: new Date(
            Date.now() +
              86400000 * this.config.get<number>("EVIDENCE_RETENTION_DAYS", 30),
          ),
        })
        .where(eq(uploads.id, evidence.id));
      await this.clearApproval(tx, profile);
      await this.audit(
        tx,
        userId,
        "provider_evidence.submitted",
        "provider_verification",
        dimension.id,
        { dimension: input.dimension, revision: updated.revision },
      );
      return this.dimensionView(updated, evidence.id);
    });
  }
  private async requirements(tx: Tx, profile: Profile, approved: boolean) {
    const dimensions = await tx
      .select()
      .from(providerVerifications)
      .where(eq(providerVerifications.providerId, profile.id));
    for (const name of this.requiredDimensions) {
      const dimension = dimensions.find((d) => d.dimension === name);
      if (
        !dimension ||
        !(approved
          ? dimension.status === "verified"
          : ["pending", "verified"].includes(dimension.status))
      )
        throw new DomainError(
          "PROVIDER_EVIDENCE_REQUIRED",
          `Submit ${name} evidence${approved ? " and have it approved" : ""} before continuing.`,
          409,
        );
      // Approved evidence may have been purged by retention; its audited decision remains valid.
      if (dimension.status === "pending") {
        const [ready] = await tx
          .select({ id: uploads.id })
          .from(providerEvidenceSubmissions)
          .innerJoin(
            uploads,
            eq(providerEvidenceSubmissions.uploadId, uploads.id),
          )
          .where(
            and(
              eq(providerEvidenceSubmissions.verificationId, dimension.id),
              eq(providerEvidenceSubmissions.revision, dimension.revision),
              eq(uploads.status, "ready"),
              gt(uploads.retainUntil, new Date()),
            ),
          )
          .limit(1);
        if (!ready)
          throw new DomainError(
            "EVIDENCE_NOT_READY",
            "Pending evidence is no longer available; request resubmission.",
            409,
          );
      }
    }
    const [service] = await tx
      .select({ id: services.id })
      .from(services)
      .innerJoin(
        serviceCategories,
        eq(services.categoryId, serviceCategories.id),
      )
      .where(
        and(
          eq(services.providerId, profile.id),
          inArray(services.status, ["draft", "active", "paused"]),
          visibleCategory(serviceCategories.id),
        ),
      )
      .limit(1);
    if (!service)
      throw new DomainError(
        "PROVIDER_SERVICE_REQUIRED",
        "Create at least one service in an active category before submitting or publishing.",
        409,
      );
  }
  async submit(userId: string) {
    return this.db.transaction(async (tx) => {
      await this.lockUser(tx, userId);
      const row = await this.profile(tx, userId);
      this.editable(row);
      if (row.approvedAt && row.reviewStatus === "approved")
        throw new DomainError(
          "PROVIDER_ALREADY_APPROVED",
          "This profile is approved; use publish to go live.",
          409,
        );
      await this.requirements(tx, row, false);
      const [updated] = await tx
        .update(providerProfiles)
        .set({
          status: "pending_verification",
          reviewStatus: "pending",
          reviewRevision: row.reviewRevision + 1,
          submittedAt: new Date(),
          reviewedAt: null,
          approvedAt: null,
          reviewReason: null,
          updatedAt: new Date(),
        })
        .where(eq(providerProfiles.id, row.id))
        .returning();
      await this.audit(
        tx,
        userId,
        "provider_profile.submitted",
        "provider",
        row.id,
        { revision: updated.reviewRevision },
      );
      return updated;
    });
  }
  async setStatus(userId: string, status: "active" | "paused") {
    return this.db.transaction(async (tx) => {
      await this.lockUser(tx, userId);
      const row = await this.profile(tx, userId);
      if (row.status === "suspended")
        throw new DomainError(
          "PROVIDER_SUSPENDED",
          "Suspended providers cannot reactivate themselves.",
          403,
        );
      if (!row.approvedAt || row.reviewStatus !== "approved")
        throw new DomainError(
          "PROVIDER_NOT_APPROVED",
          "Staff approval is required before publishing or pausing.",
          403,
        );
      if (status === "active") await this.requirements(tx, row, true);
      const [updated] = await tx
        .update(providerProfiles)
        .set({ status, updatedAt: new Date() })
        .where(eq(providerProfiles.id, row.id))
        .returning();
      if (row.status !== status)
        await this.audit(
          tx,
          userId,
          status === "active"
            ? "provider_profile.published"
            : "provider_profile.paused",
          "provider",
          row.id,
        );
      return updated;
    });
  }
  async onboarding(userId: string) {
    const [profile] = await this.db
      .select()
      .from(providerProfiles)
      .where(eq(providerProfiles.userId, userId))
      .limit(1);
    if (!profile)
      return {
        profile: null,
        services: [],
        portfolio: [],
        verification: [],
        steps: {},
        requirements: {
          requiredDimensions: this.requiredDimensions,
          optionalDimensions: ["cac"],
          serviceRequired: true,
        },
        canSubmit: false,
        canPublish: false,
      };
    const [serviceRows, portfolio, verification, stepRows] = await Promise.all([
      this.db
        .select()
        .from(services)
        .where(eq(services.providerId, profile.id)),
      this.db
        .select()
        .from(portfolioItems)
        .where(eq(portfolioItems.providerId, profile.id)),
      this.dimensions(profile.id),
      this.db
        .select()
        .from(providerOnboardingSteps)
        .where(eq(providerOnboardingSteps.providerId, profile.id)),
    ]);
    const hasService = serviceRows.some((s) => s.status !== "archived");
    return {
      profile,
      services: serviceRows,
      portfolio,
      verification,
      steps: Object.fromEntries(
        stepRows.map((s) => [
          s.step,
          { values: s.values, updatedAt: s.updatedAt },
        ]),
      ),
      requirements: {
        requiredDimensions: this.requiredDimensions,
        optionalDimensions: ["cac"],
        serviceRequired: true,
      },
      canSubmit:
        ["not_submitted", "rejected", "requires_more_information"].includes(
          profile.reviewStatus,
        ) &&
        hasService &&
        this.requiredDimensions.every((name) =>
          verification.some(
            (v) =>
              v.dimension === name &&
              ["pending", "verified"].includes(v.status),
          ),
        ),
      canPublish:
        profile.reviewStatus === "approved" &&
        Boolean(profile.approvedAt) &&
        hasService,
    };
  }
  async saveStep(userId: string, step: string, input: OnboardingStepInput) {
    const validators: Record<string, any> = {
      profile: ProviderUpdateInput,
      services: ServiceDraft,
      portfolio: PortfolioUpdateInput,
      evidence: EvidenceDraft,
    };
    if (!Object.hasOwn(validators, step) && step !== "preview")
      throw new DomainError(
        "INVALID_ONBOARDING_STEP",
        "Use profile, services, portfolio, evidence, or preview.",
        400,
      );
    if (
      JSON.stringify(input.values).length > 16000 ||
      Object.values(input.values).some((v) => v === null)
    )
      throw new DomainError(
        "INVALID_ONBOARDING_VALUES",
        "Draft fields must be non-null and under 16 KB.",
        400,
      );
    if (step === "preview") {
      if (
        Object.keys(input.values).some((k) => k !== "ready") ||
        ("ready" in input.values && typeof input.values.ready !== "boolean")
      )
        throw new DomainError(
          "INVALID_ONBOARDING_VALUES",
          "Preview accepts only an optional boolean ready field.",
          400,
        );
    } else {
      const draft = plainToInstance(validators[step], input.values);
      if (
        validateSync(draft as object, {
          whitelist: true,
          forbidNonWhitelisted: true,
        }).length
      )
        throw new DomainError(
          "INVALID_ONBOARDING_VALUES",
          "Draft fields do not match this onboarding step.",
          400,
        );
    }
    await this.db.transaction(async (tx) => {
      await this.lockUser(tx, userId);
      const profile = await this.profile(tx, userId);
      this.editable(profile);
      await tx
        .insert(providerOnboardingSteps)
        .values({ providerId: profile.id, step, values: input.values })
        .onConflictDoUpdate({
          target: [
            providerOnboardingSteps.providerId,
            providerOnboardingSteps.step,
          ],
          set: { values: input.values, updatedAt: new Date() },
        });
    });
    return this.onboarding(userId);
  }
  private validatePublicUrl(value?: string | null) {
    if (
      value &&
      (!value.startsWith("https://") ||
        /(?:student-evidence|provider-evidence|\/authenticated\/|\/download\?)/i.test(
          value,
        ))
    )
      throw new DomainError(
        "PUBLIC_PORTFOLIO_URL_REQUIRED",
        "Use an HTTPS public URL; private verification evidence cannot be published.",
        400,
      );
  }
  private portfolioValues(
    input: PortfolioInput | typeof portfolioItems.$inferSelect,
  ) {
    if (input.type === "image" && !input.assetUrl)
      throw new DomainError(
        "PORTFOLIO_ASSET_REQUIRED",
        "Image portfolio items require a public assetUrl.",
        400,
      );
    if (input.type === "external_link" && !input.externalUrl)
      throw new DomainError(
        "PORTFOLIO_LINK_REQUIRED",
        "External links require an externalUrl.",
        400,
      );
    for (const value of [input.assetUrl, input.externalUrl]) {
      if (
        value &&
        (!value.startsWith("https://") ||
          /(?:student-evidence|provider-evidence|\/authenticated\/|\/download\?)/i.test(
            value,
          ))
      )
        throw new DomainError(
          "PUBLIC_PORTFOLIO_URL_REQUIRED",
          "Use an HTTPS public URL; private verification evidence cannot be published.",
          400,
        );
    }
  }
  async portfolio(userId: string) {
    const p = await this.own(userId);
    return this.db
      .select()
      .from(portfolioItems)
      .where(eq(portfolioItems.providerId, p.id))
      .orderBy(desc(portfolioItems.createdAt));
  }
  async addPortfolio(userId: string, input: PortfolioInput) {
    this.portfolioValues(input);
    return this.db.transaction(async (tx) => {
      await this.lockUser(tx, userId);
      const profile = await this.profile(tx, userId);
      this.editable(profile);
      const items = await tx
        .select({ id: portfolioItems.id })
        .from(portfolioItems)
        .where(eq(portfolioItems.providerId, profile.id))
        .limit(30);
      if (items.length >= 30)
        throw new DomainError(
          "PORTFOLIO_LIMIT",
          "A provider can keep at most 30 portfolio items.",
          409,
        );
      const [item] = await tx
        .insert(portfolioItems)
        .values({
          providerId: profile.id,
          ...input,
          type: input.type as (typeof portfolioItems.$inferSelect)["type"],
        })
        .returning();
      await this.clearApproval(tx, profile);
      await this.audit(
        tx,
        userId,
        "portfolio.created",
        "portfolio_item",
        item.id,
      );
      return item;
    });
  }
  async updatePortfolio(
    userId: string,
    id: string,
    input: PortfolioUpdateInput,
  ) {
    if (Object.values(input).every((v) => v === undefined))
      throw new DomainError(
        "EMPTY_UPDATE",
        "Provide at least one portfolio field.",
        400,
      );
    return this.db.transaction(async (tx) => {
      await this.lockUser(tx, userId);
      const profile = await this.profile(tx, userId);
      this.editable(profile);
      const [item] = await tx
        .select()
        .from(portfolioItems)
        .where(
          and(
            eq(portfolioItems.id, id),
            eq(portfolioItems.providerId, profile.id),
          ),
        )
        .limit(1)
        .for("update");
      if (!item)
        throw new DomainError(
          "PORTFOLIO_NOT_FOUND",
          "Portfolio item not found.",
          404,
        );
      const patch = Object.fromEntries(
        Object.entries(input).filter(([, v]) => v !== undefined),
      );
      this.portfolioValues({ ...item, ...patch });
      const [updated] = await tx
        .update(portfolioItems)
        .set({
          ...input,
          type: input.type as
            (typeof portfolioItems.$inferSelect)["type"] | undefined,
        })
        .where(eq(portfolioItems.id, id))
        .returning();
      await this.clearApproval(tx, profile);
      await this.audit(tx, userId, "portfolio.updated", "portfolio_item", id);
      return updated;
    });
  }
  async deletePortfolio(userId: string, id: string) {
    await this.db.transaction(async (tx) => {
      await this.lockUser(tx, userId);
      const profile = await this.profile(tx, userId);
      this.editable(profile);
      const [item] = await tx
        .delete(portfolioItems)
        .where(
          and(
            eq(portfolioItems.id, id),
            eq(portfolioItems.providerId, profile.id),
          ),
        )
        .returning();
      if (!item)
        throw new DomainError(
          "PORTFOLIO_NOT_FOUND",
          "Portfolio item not found.",
          404,
        );
      await this.clearApproval(tx, profile);
      await this.audit(tx, userId, "portfolio.deleted", "portfolio_item", id);
    });
  }
  async createService(userId: string, input: CreateServiceDto) {
    return this.db.transaction(async (tx) => {
      await this.lockUser(tx, userId);
      const profile = await this.profile(tx, userId);
      this.editable(profile);
      const [category] = await tx
        .select({ id: serviceCategories.id })
        .from(serviceCategories)
        .where(
          and(
            eq(serviceCategories.id, input.categoryId),
            visibleCategory(serviceCategories.id),
          ),
        )
        .limit(1);
      if (!category)
        throw new DomainError(
          "CATEGORY_NOT_FOUND",
          "Choose an active service category.",
          404,
        );
      if (
        (input.currency ?? "NGN") !== "NGN" ||
        (input.pricingType !== "custom_quote" &&
          (input.priceMinor === undefined || input.priceMinor <= 0))
      )
        throw new DomainError(
          "INVALID_SERVICE_PRICE",
          "Use NGN and a positive price for priced services.",
          400,
        );
      const [service] = await tx
        .insert(services)
        .values({ providerId: profile.id, ...input, status: "draft" })
        .returning();
      await this.audit(tx, userId, "service.created", "service", service.id);
      return service;
    });
  }
  async updateService(userId: string, id: string, input: UpdateServiceDto) {
    if (Object.values(input).every((v) => v === undefined))
      throw new DomainError(
        "EMPTY_UPDATE",
        "Provide at least one service field.",
        400,
      );
    return this.db.transaction(async (tx) => {
      await this.lockUser(tx, userId);
      const profile = await this.profile(tx, userId);
      this.editable(profile);
      const [existing] = await tx
        .select()
        .from(services)
        .where(and(eq(services.id, id), eq(services.providerId, profile.id)))
        .limit(1)
        .for("update");
      if (!existing)
        throw new DomainError("SERVICE_NOT_FOUND", "Service not found.", 404);
      const next = {
        ...existing,
        ...Object.fromEntries(
          Object.entries(input).filter(([, v]) => v !== undefined),
        ),
      };
      if (
        next.pricingType !== "custom_quote" &&
        (!next.priceMinor || next.priceMinor <= 0)
      )
        throw new DomainError(
          "INVALID_SERVICE_PRICE",
          "A positive price is required for priced services.",
          400,
        );
      if (next.status === "active") {
        if (
          profile.status !== "active" ||
          !profile.approvedAt ||
          profile.reviewStatus !== "approved"
        )
          throw new DomainError(
            "PROVIDER_NOT_APPROVED",
            "Publish an approved provider before activating services.",
            403,
          );
        const [category] = await tx
          .select({ id: serviceCategories.id })
          .from(serviceCategories)
          .where(
            and(
              eq(serviceCategories.id, existing.categoryId),
              visibleCategory(serviceCategories.id),
            ),
          )
          .limit(1);
        if (!category)
          throw new DomainError(
            "CATEGORY_NOT_FOUND",
            "The service category is inactive.",
            409,
          );
      }
      const [updated] = await tx
        .update(services)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(services.id, id))
        .returning();
      await this.audit(tx, userId, "service.updated", "service", id);
      return updated;
    });
  }
  async reviewQueue(query: ListQuery, dimensions: boolean) {
    const status = query.status ?? "pending";
    if (dimensions) {
      if (
        ![
          "not_submitted",
          "pending",
          "verified",
          "rejected",
          "requires_more_information",
        ].includes(status)
      )
        throw new DomainError(
          "INVALID_STATUS",
          "Invalid verification status.",
          400,
        );
      const rows = await this.db
        .select({
          row: providerVerifications,
          uploadId: providerEvidenceSubmissions.uploadId,
        })
        .from(providerVerifications)
        .leftJoin(
          providerEvidenceSubmissions,
          and(
            eq(
              providerEvidenceSubmissions.verificationId,
              providerVerifications.id,
            ),
            eq(
              providerEvidenceSubmissions.revision,
              providerVerifications.revision,
            ),
          ),
        )
        .where(
          eq(
            providerVerifications.status,
            status as (typeof providerVerifications.$inferSelect)["status"],
          ),
        )
        .orderBy(desc(providerVerifications.submittedAt))
        .limit(query.limit ?? 20)
        .offset(query.offset ?? 0);
      return rows.map((r) => this.dimensionView(r.row, r.uploadId));
    }
    if (
      ![
        "not_submitted",
        "pending",
        "approved",
        "rejected",
        "requires_more_information",
      ].includes(status)
    )
      throw new DomainError(
        "INVALID_STATUS",
        "Use a profile reviewStatus, such as pending or approved.",
        400,
      );
    return this.db
      .select()
      .from(providerProfiles)
      .where(eq(providerProfiles.reviewStatus, status))
      .orderBy(desc(providerProfiles.submittedAt))
      .limit(query.limit ?? 20)
      .offset(query.offset ?? 0);
  }
  private async applicant(userId: string) {
    const [user] = await this.db
      .select({
        id: users.id,
        fullName: users.fullName,
        universityId: users.universityId,
        campusId: users.campusId,
        studentVerificationStatus: users.studentVerificationStatus,
        accountStatus: users.accountStatus,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return user;
  }
  async reviewDetail(id: string, dimension: boolean) {
    if (dimension) {
      const [row] = await this.db
        .select()
        .from(providerVerifications)
        .where(eq(providerVerifications.id, id))
        .limit(1);
      if (!row)
        throw new DomainError(
          "VERIFICATION_NOT_FOUND",
          "Provider verification not found.",
          404,
        );
      const submissions = await this.db
        .select({
          id: providerEvidenceSubmissions.id,
          uploadId: providerEvidenceSubmissions.uploadId,
          revision: providerEvidenceSubmissions.revision,
          status: providerEvidenceSubmissions.status,
          submittedAt: providerEvidenceSubmissions.submittedAt,
          decidedAt: providerEvidenceSubmissions.decidedAt,
        })
        .from(providerEvidenceSubmissions)
        .where(eq(providerEvidenceSubmissions.verificationId, id))
        .orderBy(desc(providerEvidenceSubmissions.revision));
      const [profile] = await this.db
        .select({ userId: providerProfiles.userId })
        .from(providerProfiles)
        .where(eq(providerProfiles.id, row.providerId))
        .limit(1);
      return {
        applicant: await this.applicant(profile.userId),
        ...this.dimensionView(row, submissions[0]?.uploadId ?? null),
        submissions,
        decisions: await this.db
          .select()
          .from(providerReviewDecisions)
          .where(
            and(
              eq(providerReviewDecisions.resourceType, "provider_verification"),
              eq(providerReviewDecisions.resourceId, id),
            ),
          )
          .orderBy(desc(providerReviewDecisions.createdAt)),
      };
    }
    const [row] = await this.db
      .select()
      .from(providerProfiles)
      .where(eq(providerProfiles.id, id))
      .limit(1);
    if (!row)
      throw new DomainError("PROVIDER_NOT_FOUND", "Provider not found.", 404);
    return {
      ...row,
      applicant: await this.applicant(row.userId),
      verification: await this.dimensions(id),
      services: await this.db
        .select()
        .from(services)
        .where(eq(services.providerId, id)),
      portfolio: await this.db
        .select()
        .from(portfolioItems)
        .where(eq(portfolioItems.providerId, id)),
      decisions: await this.db
        .select()
        .from(providerReviewDecisions)
        .where(
          and(
            eq(providerReviewDecisions.resourceType, "provider"),
            eq(providerReviewDecisions.resourceId, id),
          ),
        )
        .orderBy(desc(providerReviewDecisions.createdAt)),
    };
  }
  private async decision(
    tx: Tx,
    actorId: string,
    profile: Profile,
    resourceType: string,
    resourceId: string,
    revision: number,
    decision: string,
    reason: string,
  ) {
    const [record] = await tx
      .insert(providerReviewDecisions)
      .values({ actorId, resourceType, resourceId, revision, decision, reason })
      .returning();
    await this.audit(
      tx,
      actorId,
      `${resourceType}.decided`,
      resourceType,
      resourceId,
      { decision, revision },
      reason,
    );
    await tx.insert(notifications).values({
      userId: profile.userId,
      type: "provider_review",
      title: "Provider review updated",
      body: reason,
      resourceType,
      resourceId,
    });
    return record;
  }
  async decideEvidence(
    actorId: string,
    id: string,
    input: ProviderEvidenceDecisionInput,
  ) {
    const [initial] = await this.db
      .select({ profile: providerProfiles })
      .from(providerVerifications)
      .innerJoin(
        providerProfiles,
        eq(providerVerifications.providerId, providerProfiles.id),
      )
      .where(eq(providerVerifications.id, id))
      .limit(1);
    if (!initial)
      throw new DomainError(
        "VERIFICATION_NOT_FOUND",
        "Provider verification not found.",
        404,
      );
    if (initial.profile.userId === actorId)
      throw new DomainError(
        "SELF_REVIEW_FORBIDDEN",
        "Another reviewer must decide your evidence.",
        403,
      );
    return this.db.transaction(async (tx) => {
      await this.lockUser(
        tx,
        initial.profile.userId,
        input.decision === "verified",
      );
      const profile = await this.profile(tx, initial.profile.userId);
      const [row] = await tx
        .select()
        .from(providerVerifications)
        .where(eq(providerVerifications.id, id))
        .limit(1)
        .for("update");
      if (!row || row.status !== "pending")
        throw new DomainError(
          "VERIFICATION_ALREADY_DECIDED",
          "This evidence is no longer pending.",
          409,
        );
      if (input.revision !== row.revision)
        throw new DomainError(
          "STALE_REVIEW_REVISION",
          "Reload the evidence before deciding its current revision.",
          409,
        );
      if (!input.reason.trim())
        throw new DomainError(
          "DECISION_REASON_REQUIRED",
          "Provide a decision reason.",
          400,
        );
      const [submission] = await tx
        .select()
        .from(providerEvidenceSubmissions)
        .where(
          and(
            eq(providerEvidenceSubmissions.verificationId, id),
            eq(providerEvidenceSubmissions.revision, row.revision),
          ),
        )
        .limit(1)
        .for("update");
      if (input.decision === "verified") {
        const [evidence] = submission
          ? await tx
              .select()
              .from(uploads)
              .where(
                and(
                  eq(uploads.id, submission.uploadId),
                  eq(uploads.userId, profile.userId),
                  eq(uploads.providerVerificationId, id),
                  eq(uploads.status, "ready"),
                  gt(uploads.retainUntil, new Date()),
                ),
              )
              .limit(1)
              .for("update")
          : [];
        if (!evidence)
          throw new DomainError(
            "EVIDENCE_NOT_READY",
            "Approval requires available evidence.",
            409,
          );
      }
      const status = input.decision as
        "verified" | "rejected" | "requires_more_information";
      await tx
        .update(providerVerifications)
        .set({ status, decidedAt: new Date(), reason: input.reason.trim() })
        .where(eq(providerVerifications.id, id));
      if (submission) {
        await tx
          .update(providerEvidenceSubmissions)
          .set({ status, decidedAt: new Date() })
          .where(eq(providerEvidenceSubmissions.id, submission.id));
        await tx
          .update(uploads)
          .set({
            retainUntil: new Date(
              Date.now() +
                86400000 *
                  this.config.get<number>("EVIDENCE_RETENTION_DAYS", 30),
            ),
          })
          .where(eq(uploads.id, submission.uploadId));
      }
      // Failed required proof returns an overall pending profile for corrections.
      if (
        status !== "verified" &&
        this.requiredDimensions.includes(row.dimension) &&
        profile.reviewStatus === "pending"
      ) {
        await tx
          .update(providerProfiles)
          .set({
            status: "draft",
            reviewStatus: "requires_more_information",
            reviewedAt: new Date(),
            reviewReason: input.reason.trim(),
            approvedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(providerProfiles.id, profile.id));
        await this.decision(
          tx,
          actorId,
          profile,
          "provider",
          profile.id,
          profile.reviewRevision,
          "requires_more_information",
          input.reason.trim(),
        );
      }
      return this.decision(
        tx,
        actorId,
        profile,
        "provider_verification",
        id,
        row.revision,
        status,
        input.reason.trim(),
      );
    });
  }
  async decideProfile(
    actorId: string,
    id: string,
    input: ProviderDecisionInput,
  ) {
    const [initial] = await this.db
      .select()
      .from(providerProfiles)
      .where(eq(providerProfiles.id, id))
      .limit(1);
    if (!initial)
      throw new DomainError("PROVIDER_NOT_FOUND", "Provider not found.", 404);
    if (initial.userId === actorId)
      throw new DomainError(
        "SELF_REVIEW_FORBIDDEN",
        "Another reviewer must approve your profile.",
        403,
      );
    return this.db.transaction(async (tx) => {
      await this.lockUser(tx, initial.userId, input.decision === "active");
      const row = await this.profile(tx, initial.userId);
      if (
        row.reviewStatus !== "pending" ||
        row.status !== "pending_verification"
      )
        throw new DomainError(
          "PROVIDER_ALREADY_DECIDED",
          "This profile is no longer pending.",
          409,
        );
      if (input.revision !== row.reviewRevision)
        throw new DomainError(
          "STALE_REVIEW_REVISION",
          "Reload the profile before deciding its current revision.",
          409,
        );
      if (!input.reason.trim())
        throw new DomainError(
          "DECISION_REASON_REQUIRED",
          "Provide a decision reason.",
          400,
        );
      if (input.decision === "active") await this.requirements(tx, row, true);
      await tx
        .update(providerProfiles)
        .set({
          status: "draft",
          reviewStatus:
            input.decision === "active" ? "approved" : input.decision,
          approvedAt: input.decision === "active" ? new Date() : null,
          reviewedAt: new Date(),
          reviewReason: input.reason.trim(),
          updatedAt: new Date(),
        })
        .where(eq(providerProfiles.id, id));
      return this.decision(
        tx,
        actorId,
        row,
        "provider",
        id,
        row.reviewRevision,
        input.decision,
        input.reason.trim(),
      );
    });
  }
}
