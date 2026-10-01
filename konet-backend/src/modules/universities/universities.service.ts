import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import { domainToASCII } from "node:url";
import { DATABASE, Database } from "../../database/database.module";
import {
  auditEvents,
  campuses,
  universities,
  universityEmailDomains,
} from "../../database/schema";
import { DomainError } from "../../common/errors/domain.error";
import {
  CampusInput,
  CampusUpdateInput,
  DomainInput,
  ListQuery,
  UniversityInput,
  UniversityUpdateInput,
} from "../contracts/contract.dto";
type Executor = Pick<Database, "select" | "insert" | "update" | "delete">;
function isUniqueConflict(error: unknown): boolean {
  const failure = error as { code?: string; cause?: { code?: string } };
  return (failure.code ?? failure.cause?.code) === "23505";
}
@Injectable()
export class UniversitiesService {
  constructor(@Inject(DATABASE) private db: Database) {}
  private async university(
    db: Executor,
    id: string,
    activeOnly = false,
    lock = false,
  ) {
    const query = db
      .select()
      .from(universities)
      .where(
        and(
          eq(universities.id, id),
          activeOnly ? eq(universities.isActive, true) : undefined,
        ),
      )
      .limit(1);
    const [row] = lock ? await query.for("update") : await query;
    if (!row)
      throw new DomainError(
        "UNIVERSITY_NOT_FOUND",
        "University not found.",
        404,
      );
    return row;
  }
  async list() {
    const rows = await this.db
      .select()
      .from(universities)
      .where(eq(universities.isActive, true))
      .orderBy(universities.name, universities.id);
    return Promise.all(rows.map((row) => this.withCampuses(row)));
  }
  private async withCampuses(row: typeof universities.$inferSelect) {
    return { ...row, campuses: await this.publicCampuses(row.id) };
  }
  async one(id: string) {
    return this.withCampuses(await this.university(this.db, id, true));
  }
  async publicCampuses(id: string) {
    await this.university(this.db, id, true);
    return this.db
      .select()
      .from(campuses)
      .where(and(eq(campuses.universityId, id), eq(campuses.isActive, true)))
      .orderBy(campuses.name, campuses.id);
  }
  async verificationMethods(id: string) {
    await this.university(this.db, id, true);
    const domains = await this.db
      .select({ domain: universityEmailDomains.domain })
      .from(universityEmailDomains)
      .where(
        and(
          eq(universityEmailDomains.universityId, id),
          eq(universityEmailDomains.approved, true),
        ),
      )
      .orderBy(universityEmailDomains.domain);
    return {
      methods: [
        ...(domains.length ? ["university_email"] : []),
        "student_id",
        "manual_document",
      ],
      approvedEmailDomains: domains.map((row) => row.domain),
    };
  }
  async adminList(query: ListQuery) {
    if (query.status && !["active", "inactive"].includes(query.status))
      throw new DomainError(
        "INVALID_STATUS",
        "Use active or inactive for university status.",
        400,
      );
    return this.db
      .select()
      .from(universities)
      .where(
        query.status
          ? eq(universities.isActive, query.status === "active")
          : undefined,
      )
      .orderBy(universities.name, universities.id)
      .limit(query.limit ?? 20)
      .offset(query.offset ?? 0);
  }
  private slug(value: string) {
    const normalized = value.trim().toLowerCase();
    if (
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized) ||
      normalized.length > 100
    )
      throw new DomainError(
        "INVALID_SLUG",
        "Use lowercase letters, numbers, and single hyphens for slugs (maximum 100 characters).",
        400,
      );
    return normalized;
  }
  private name(value: string, max = 255) {
    const normalized = value.trim();
    if (normalized.length < 2 || normalized.length > max)
      throw new DomainError(
        "INVALID_NAME",
        `Names must contain 2 to ${max} characters.`,
        400,
      );
    return normalized;
  }
  private domain(value: string) {
    const normalized = domainToASCII(value.trim().toLowerCase());
    if (
      !normalized ||
      normalized.length > 253 ||
      !normalized.includes(".") ||
      normalized
        .split(".")
        .some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
    )
      throw new DomainError(
        "INVALID_EMAIL_DOMAIN",
        "Provide a domain such as students.university.edu.ng, without a URL, wildcard, path, or email address.",
        400,
      );
    return normalized;
  }
  private async mutate<T>(
    run: (tx: Executor) => Promise<T>,
    duplicateCode: string,
  ): Promise<T> {
    try {
      return await this.db.transaction(run);
    } catch (error) {
      if (isUniqueConflict(error))
        throw new DomainError(
          duplicateCode,
          "That directory entry already exists.",
          409,
        );
      throw error;
    }
  }
  private async audit(
    tx: Executor,
    actorId: string,
    action: string,
    resourceType: string,
    resourceId: string,
    details: Record<string, unknown>,
  ) {
    await tx
      .insert(auditEvents)
      .values({ actorId, action, resourceType, resourceId, details });
  }
  async create(actorId: string, input: UniversityInput) {
    return this.mutate(async (tx) => {
      const [row] = await tx
        .insert(universities)
        .values({
          ...input,
          name: this.name(input.name),
          shortName: this.name(input.shortName, 50),
          slug: this.slug(input.slug),
          city: this.name(input.city, 100),
          state: this.name(input.state, 100),
          country: input.country ? this.name(input.country, 100) : "Nigeria",
        })
        .returning();
      await this.audit(
        tx,
        actorId,
        "university.created",
        "university",
        row.id,
        { values: row },
      );
      return row;
    }, "UNIVERSITY_EXISTS");
  }
  async update(actorId: string, id: string, input: UniversityUpdateInput) {
    if (Object.values(input).every((value) => value === undefined))
      throw new DomainError(
        "EMPTY_UPDATE",
        "Provide at least one field to update.",
        400,
      );
    return this.mutate(async (tx) => {
      const before = await this.university(tx, id, false, true);
      const normalized = {
        ...input,
        ...(input.name !== undefined ? { name: this.name(input.name) } : {}),
        ...(input.shortName !== undefined
          ? { shortName: this.name(input.shortName, 50) }
          : {}),
        ...(input.slug !== undefined ? { slug: this.slug(input.slug) } : {}),
        ...(input.city !== undefined
          ? { city: this.name(input.city, 100) }
          : {}),
        ...(input.state !== undefined
          ? { state: this.name(input.state, 100) }
          : {}),
        ...(input.country !== undefined
          ? { country: this.name(input.country, 100) }
          : {}),
      };
      const [row] = await tx
        .update(universities)
        .set({ ...normalized, updatedAt: new Date() })
        .where(eq(universities.id, id))
        .returning();
      await this.audit(tx, actorId, "university.updated", "university", id, {
        before,
        after: row,
      });
      return row;
    }, "UNIVERSITY_EXISTS");
  }
  async adminCampuses(universityId: string) {
    await this.university(this.db, universityId);
    return this.db
      .select()
      .from(campuses)
      .where(eq(campuses.universityId, universityId))
      .orderBy(campuses.name, campuses.id);
  }
  async createCampus(
    actorId: string,
    universityId: string,
    input: CampusInput,
  ) {
    return this.mutate(async (tx) => {
      await this.university(tx, universityId, false, true);
      const [row] = await tx
        .insert(campuses)
        .values({
          universityId,
          ...input,
          name: this.name(input.name, 150),
          slug: this.slug(input.slug),
        })
        .returning();
      await this.audit(tx, actorId, "campus.created", "campus", row.id, {
        values: row,
      });
      return row;
    }, "CAMPUS_EXISTS");
  }
  async updateCampus(
    actorId: string,
    universityId: string,
    id: string,
    input: CampusUpdateInput,
  ) {
    if (Object.values(input).every((value) => value === undefined))
      throw new DomainError(
        "EMPTY_UPDATE",
        "Provide at least one field to update.",
        400,
      );
    return this.mutate(async (tx) => {
      await this.university(tx, universityId, false, true);
      const normalized = {
        ...input,
        ...(input.name !== undefined
          ? { name: this.name(input.name, 150) }
          : {}),
        ...(input.slug !== undefined ? { slug: this.slug(input.slug) } : {}),
      };
      const [row] = await tx
        .update(campuses)
        .set(normalized)
        .where(
          and(eq(campuses.id, id), eq(campuses.universityId, universityId)),
        )
        .returning();
      if (!row)
        throw new DomainError(
          "CAMPUS_NOT_FOUND",
          "Campus not found in this university.",
          404,
        );
      await this.audit(tx, actorId, "campus.updated", "campus", row.id, {
        values: row,
      });
      return row;
    }, "CAMPUS_EXISTS");
  }
  async archiveCampus(actorId: string, universityId: string, id: string) {
    await this.updateCampus(actorId, universityId, id, { isActive: false });
  }
  async domains(universityId: string) {
    await this.university(this.db, universityId);
    return this.db
      .select()
      .from(universityEmailDomains)
      .where(eq(universityEmailDomains.universityId, universityId))
      .orderBy(universityEmailDomains.domain);
  }
  async createDomain(
    actorId: string,
    universityId: string,
    input: DomainInput,
  ) {
    return this.mutate(async (tx) => {
      await this.university(tx, universityId, false, true);
      const [row] = await tx
        .insert(universityEmailDomains)
        .values({
          universityId,
          domain: this.domain(input.domain),
          approved: input.approved ?? false,
        })
        .returning();
      await this.audit(
        tx,
        actorId,
        "university_domain.created",
        "university_email_domain",
        row.id,
        { values: row },
      );
      return row;
    }, "EMAIL_DOMAIN_EXISTS");
  }
  async updateDomain(
    actorId: string,
    universityId: string,
    id: string,
    input: DomainInput,
  ) {
    return this.mutate(async (tx) => {
      await this.university(tx, universityId, false, true);
      const [row] = await tx
        .update(universityEmailDomains)
        .set({
          domain: this.domain(input.domain),
          ...(input.approved !== undefined ? { approved: input.approved } : {}),
        })
        .where(
          and(
            eq(universityEmailDomains.id, id),
            eq(universityEmailDomains.universityId, universityId),
          ),
        )
        .returning();
      if (!row)
        throw new DomainError(
          "EMAIL_DOMAIN_NOT_FOUND",
          "Email domain not found in this university.",
          404,
        );
      await this.audit(
        tx,
        actorId,
        "university_domain.updated",
        "university_email_domain",
        row.id,
        { values: row },
      );
      return row;
    }, "EMAIL_DOMAIN_EXISTS");
  }
  async deleteDomain(actorId: string, universityId: string, id: string) {
    await this.mutate(async (tx) => {
      await this.university(tx, universityId, false, true);
      const [row] = await tx
        .delete(universityEmailDomains)
        .where(
          and(
            eq(universityEmailDomains.id, id),
            eq(universityEmailDomains.universityId, universityId),
          ),
        )
        .returning();
      if (!row)
        throw new DomainError(
          "EMAIL_DOMAIN_NOT_FOUND",
          "Email domain not found in this university.",
          404,
        );
      await this.audit(
        tx,
        actorId,
        "university_domain.deleted",
        "university_email_domain",
        row.id,
        { values: row },
      );
    }, "EMAIL_DOMAIN_EXISTS");
  }
  async audits(query: ListQuery) {
    if (query.status)
      throw new DomainError(
        "INVALID_FILTER",
        "Audit events do not have a status filter.",
        400,
      );
    return this.db
      .select()
      .from(auditEvents)
      .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
      .limit(query.limit ?? 20)
      .offset(query.offset ?? 0);
  }
}
