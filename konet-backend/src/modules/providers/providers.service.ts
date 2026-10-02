import { Inject, Injectable } from "@nestjs/common";
import {
  and,
  eq,
  ilike,
  or,
  sql,
  isNotNull,
  desc,
  exists,
  lte,
  asc,
} from "drizzle-orm";
import { DATABASE, Database } from "../../database/database.module";
import {
  providerProfiles,
  providerVerifications,
  reviews,
  services,
  users,
  portfolioItems,
} from "../../database/schema";
import { DomainError } from "../../common/errors/domain.error";
import { ProviderSearch } from "../contracts/contract.dto";
import { visibleCategory, literalSearch } from "../catalog/catalog-visibility";

@Injectable()
export class ProvidersService {
  constructor(@Inject(DATABASE) private db: Database) {}
  async list(query: ProviderSearch) {
    const conditions = [
      eq(providerProfiles.status, "active"),
      eq(providerProfiles.reviewStatus, "approved"),
      isNotNull(providerProfiles.approvedAt),
      eq(users.accountStatus, "active"),
      eq(users.studentVerificationStatus, "verified"),
    ];
    if (query.universityId)
      conditions.push(eq(users.universityId, query.universityId));
    if (query.campusId) conditions.push(eq(users.campusId, query.campusId));
    if (query.availability)
      conditions.push(eq(providerProfiles.availability, query.availability));
    if (query.categoryId || query.maxPriceMinor !== undefined) {
      const serviceConditions = [
        eq(services.providerId, providerProfiles.id),
        eq(services.status, "active"),
        visibleCategory(services.categoryId),
      ];
      if (query.categoryId)
        serviceConditions.push(eq(services.categoryId, query.categoryId));
      if (query.maxPriceMinor !== undefined)
        serviceConditions.push(lte(services.priceMinor, query.maxPriceMinor));
      conditions.push(
        exists(
          this.db
            .select({ id: services.id })
            .from(services)
            .where(and(...serviceConditions)),
        ),
      );
    }
    if (query.query)
      conditions.push(
        or(
          ilike(providerProfiles.professionalTitle, literalSearch(query.query)),
          ilike(providerProfiles.bio, literalSearch(query.query)),
        )!,
      );
    return this.db
      .select({
        id: providerProfiles.id,
        userId: providerProfiles.userId,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,
        universityId: users.universityId,
        campusId: users.campusId,
        professionalTitle: providerProfiles.professionalTitle,
        bio: providerProfiles.bio,
        availability: providerProfiles.availability,
        responseTimeMinutes: providerProfiles.responseTimeMinutes,
        coverImageUrl: providerProfiles.coverImageUrl,
      })
      .from(providerProfiles)
      .innerJoin(users, eq(providerProfiles.userId, users.id))
      .where(and(...conditions))
      .orderBy(
        asc(providerProfiles.professionalTitle),
        asc(providerProfiles.id),
      )
      .limit(query.limit ?? 20)
      .offset(query.offset ?? 0);
  }
  async one(id: string) {
    const [result] = await this.db
      .select({
        id: providerProfiles.id,
        userId: providerProfiles.userId,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,
        universityId: users.universityId,
        campusId: users.campusId,
        professionalTitle: providerProfiles.professionalTitle,
        bio: providerProfiles.bio,
        availability: providerProfiles.availability,
        responseTimeMinutes: providerProfiles.responseTimeMinutes,
        coverImageUrl: providerProfiles.coverImageUrl,
      })
      .from(providerProfiles)
      .innerJoin(users, eq(providerProfiles.userId, users.id))
      .where(
        and(
          eq(providerProfiles.id, id),
          eq(providerProfiles.status, "active"),
          eq(providerProfiles.reviewStatus, "approved"),
          isNotNull(providerProfiles.approvedAt),
          eq(users.accountStatus, "active"),
          eq(users.studentVerificationStatus, "verified"),
        ),
      )
      .limit(1);
    if (!result)
      throw new DomainError("PROVIDER_NOT_FOUND", "Provider not found.", 404);
    const [stats] = await this.db
      .select({
        rating: sql<number>`coalesce(avg(${reviews.rating}),0)`,
        reviewCount: sql<number>`count(${reviews.id})`,
      })
      .from(reviews)
      .where(eq(reviews.providerId, id));
    return {
      ...result,
      reputation: {
        rating: Number(stats.rating),
        reviewCount: Number(stats.reviewCount),
      },
      verification: await this.db
        .select({
          dimension: providerVerifications.dimension,
          status: providerVerifications.status,
        })
        .from(providerVerifications)
        .where(eq(providerVerifications.providerId, id)),
      services: await this.db
        .select()
        .from(services)
        .where(
          and(
            eq(services.providerId, id),
            eq(services.status, "active"),
            visibleCategory(services.categoryId),
          ),
        ),
    };
  }
  async publicCollection(
    id: string,
    kind: "services" | "portfolio" | "reviews",
    query: import("../contracts/contract.dto").ListQuery,
  ) {
    await this.one(id);
    if (kind === "services")
      return this.db
        .select()
        .from(services)
        .where(
          and(
            eq(services.providerId, id),
            eq(services.status, "active"),
            visibleCategory(services.categoryId),
          ),
        )
        .orderBy(desc(services.createdAt))
        .limit(query.limit ?? 20)
        .offset(query.offset ?? 0);
    if (kind === "portfolio")
      return this.db
        .select()
        .from(portfolioItems)
        .where(eq(portfolioItems.providerId, id))
        .orderBy(desc(portfolioItems.createdAt))
        .limit(query.limit ?? 20)
        .offset(query.offset ?? 0);
    return this.db
      .select()
      .from(reviews)
      .where(eq(reviews.providerId, id))
      .orderBy(desc(reviews.createdAt))
      .limit(query.limit ?? 20)
      .offset(query.offset ?? 0);
  }
}
