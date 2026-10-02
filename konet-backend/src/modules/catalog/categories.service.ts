import { Inject, Injectable } from "@nestjs/common";
import { asc, eq, sql } from "drizzle-orm";
import { DATABASE, Database } from "../../database/database.module";
import { auditEvents, serviceCategories } from "../../database/schema";
import { DomainError } from "../../common/errors/domain.error";
import {
  CategoryInput,
  CategoryUpdateInput,
  ListQuery,
} from "../contracts/contract.dto";
@Injectable()
export class CategoriesService {
  constructor(@Inject(DATABASE) private db: Database) {}
  async list(query: ListQuery) {
    if (query.status && !["active", "inactive"].includes(query.status))
      throw new DomainError("INVALID_STATUS", "Use active or inactive.", 400);
    return this.db
      .select()
      .from(serviceCategories)
      .where(
        query.status
          ? eq(serviceCategories.isActive, query.status === "active")
          : undefined,
      )
      .orderBy(asc(serviceCategories.name), asc(serviceCategories.id))
      .limit(query.limit ?? 20)
      .offset(query.offset ?? 0);
  }
  private normalize(input: CategoryInput | CategoryUpdateInput) {
    const values = Object.fromEntries(
      Object.entries(input).filter(([, v]) => v !== undefined),
    ) as CategoryUpdateInput;
    if (values.name !== undefined) {
      values.name = values.name.trim();
      if (values.name.length < 2 || values.name.length > 120)
        throw new DomainError(
          "INVALID_CATEGORY_NAME",
          "Category name must contain 2–120 characters.",
          400,
        );
    }
    if (values.slug !== undefined) {
      values.slug = values.slug.trim().toLowerCase();
      if (
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.slug) ||
        values.slug.length > 120 ||
        values.slug.length < 2
      )
        throw new DomainError(
          "INVALID_CATEGORY_SLUG",
          "Use a lowercase hyphen-separated slug (2–120 characters).",
          400,
        );
    }
    return values;
  }
  async save(
    actorId: string,
    input: CategoryInput | CategoryUpdateInput,
    id?: string,
  ) {
    const values = this.normalize(input);
    if (!Object.keys(values).length)
      throw new DomainError("EMPTY_UPDATE", "Provide a category field.", 400);
    return this.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext('konet.category_tree'))`,
      );
      const rows = await tx.select().from(serviceCategories);
      const current = id ? rows.find((r) => r.id === id) : undefined;
      if (id && !current)
        throw new DomainError("CATEGORY_NOT_FOUND", "Category not found.", 404);
      if (
        values.slug &&
        rows.some((r) => r.slug === values.slug && r.id !== id)
      )
        throw new DomainError(
          "CATEGORY_EXISTS",
          "Category slug already exists.",
          409,
        );
      const parentId =
        values.parentId !== undefined ? values.parentId : current?.parentId;
      if (parentId) {
        const parent = rows.find((r) => r.id === parentId);
        if (!parent)
          throw new DomainError(
            "CATEGORY_PARENT_NOT_FOUND",
            "Parent category not found.",
            404,
          );
        const seen = new Set<string>();
        let cursor: string | null = parentId;
        while (cursor) {
          if (cursor === id || seen.has(cursor))
            throw new DomainError(
              "CATEGORY_CYCLE",
              "A category cannot belong to itself or a descendant.",
              409,
            );
          seen.add(cursor);
          cursor = rows.find((r) => r.id === cursor)?.parentId ?? null;
        }
      }
      const [saved] = id
        ? await tx
            .update(serviceCategories)
            .set(values)
            .where(eq(serviceCategories.id, id))
            .returning()
        : await tx
            .insert(serviceCategories)
            .values(values as typeof serviceCategories.$inferInsert)
            .returning();
      await tx.insert(auditEvents).values({
        actorId,
        action: id ? "category.updated" : "category.created",
        resourceType: "category",
        resourceId: saved.id,
        details: { fields: Object.keys(values) },
      });
      return saved;
    });
  }
}
