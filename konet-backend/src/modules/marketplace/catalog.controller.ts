import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { and, eq, ilike, or } from "drizzle-orm";
import { IsOptional, IsString, IsUUID } from "class-validator";
import { DomainError } from "../../common/errors/domain.error";
import { DATABASE, Database } from "../../database/database.module";
import {
  providerProfiles,
  serviceCategories,
  services,
  users,
} from "../../database/schema";
class CatalogQuery {
  @IsOptional() @IsString() query?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsUUID() universityId?: string;
}
@ApiTags("catalog")
@Controller({ version: "1" })
export class CatalogController {
  constructor(@Inject(DATABASE) private db: Database) {}
  @Get("categories") categories() {
    return this.db
      .select()
      .from(serviceCategories)
      .where(eq(serviceCategories.isActive, true));
  }
  @Get("services") list(@Query() q: CatalogQuery) {
    const conditions = [
      eq(services.status, "active"),
      eq(providerProfiles.status, "active"),
    ];
    if (q.categoryId) conditions.push(eq(services.categoryId, q.categoryId));
    if (q.universityId) conditions.push(eq(users.universityId, q.universityId));
    if (q.query)
      conditions.push(
        or(
          ilike(services.title, `%${q.query}%`),
          ilike(services.description, `%${q.query}%`),
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
      .where(and(...conditions));
  }
  @Get("services/:id") async one(@Param("id") id: string) {
    const [s] = await this.db
      .select()
      .from(services)
      .where(and(eq(services.id, id), eq(services.status, "active")))
      .limit(1);
    if (!s)
      throw new DomainError("SERVICE_NOT_FOUND", "Service not found.", 404);
    return s;
  }
}
