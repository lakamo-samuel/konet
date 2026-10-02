import {
  Controller,
  Get,
  Inject,
  Param,
  Query,
  ParseUUIDPipe,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { and, eq, ilike, or, isNotNull, lte, asc, desc } from "drizzle-orm";
import { CatalogSearch } from "../contracts/contract.dto";
import { visibleCategory, literalSearch } from "../catalog/catalog-visibility";
import { DomainError } from "../../common/errors/domain.error";
import { DATABASE, Database } from "../../database/database.module";
import {
  providerProfiles,
  serviceCategories,
  services,
  users,
} from "../../database/schema";
@ApiTags("catalog")
@Controller({ version: "1" })
export class CatalogController {
  constructor(@Inject(DATABASE) private db: Database) {}
  @Get("categories") categories() {
    return this.db
      .select()
      .from(serviceCategories)
      .where(visibleCategory(serviceCategories.id))
      .orderBy(asc(serviceCategories.name), asc(serviceCategories.id));
  }
  @Get("services") list(@Query() q: CatalogSearch) {
    const conditions = [
      eq(services.status, "active"),
      visibleCategory(services.categoryId),
      eq(providerProfiles.status, "active"),
      eq(providerProfiles.reviewStatus, "approved"),
      isNotNull(providerProfiles.approvedAt),
      eq(users.accountStatus, "active"),
      eq(users.studentVerificationStatus, "verified"),
    ];
    if (q.categoryId) conditions.push(eq(services.categoryId, q.categoryId));
    if (q.universityId) conditions.push(eq(users.universityId, q.universityId));
    if (q.campusId) conditions.push(eq(users.campusId, q.campusId));
    if (q.providerId) conditions.push(eq(services.providerId, q.providerId));
    if (q.availability)
      conditions.push(eq(providerProfiles.availability, q.availability));
    if (q.maxPriceMinor !== undefined)
      conditions.push(lte(services.priceMinor, q.maxPriceMinor));
    if (q.query)
      conditions.push(
        or(
          ilike(services.title, literalSearch(q.query)),
          ilike(services.description, literalSearch(q.query)),
        )!,
      );
    return this.db
      .select({
        id: services.id,
        title: services.title,
        description: services.description,
        pricingType: services.pricingType,
        priceMinor: services.priceMinor,
        currency: services.currency,
        categoryId: services.categoryId,
        providerId: services.providerId,
        providerName: users.fullName,
        providerTitle: providerProfiles.professionalTitle,
        universityId: users.universityId,
      })
      .from(services)
      .innerJoin(providerProfiles, eq(services.providerId, providerProfiles.id))
      .innerJoin(users, eq(providerProfiles.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(services.createdAt), asc(services.id))
      .limit(q.limit ?? 20)
      .offset(q.offset ?? 0);
  }
  @Get("services/:id") async one(@Param("id", new ParseUUIDPipe()) id: string) {
    const [s] = await this.db
      .select({ service: services })
      .from(services)
      .innerJoin(providerProfiles, eq(services.providerId, providerProfiles.id))
      .innerJoin(users, eq(providerProfiles.userId, users.id))
      .where(
        and(
          eq(services.id, id),
          eq(services.status, "active"),
          visibleCategory(services.categoryId),
          eq(providerProfiles.status, "active"),
          eq(providerProfiles.reviewStatus, "approved"),
          isNotNull(providerProfiles.approvedAt),
          eq(users.accountStatus, "active"),
          eq(users.studentVerificationStatus, "verified"),
        ),
      )
      .limit(1);
    if (!s)
      throw new DomainError("SERVICE_NOT_FOUND", "Service not found.", 404);
    return s.service;
  }
}
