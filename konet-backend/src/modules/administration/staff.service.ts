import { Inject, Injectable } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import { DATABASE, Database } from "../../database/database.module";
import { auditEvents, userRoles, users } from "../../database/schema";
import { DomainError } from "../../common/errors/domain.error";
import { StaffRole } from "./staff.guard";
import { StaffUsersQuery } from "./staff.dto";
type Executor = Pick<Database, "select" | "insert" | "delete">;
const userFields = {
  id: users.id,
  email: users.email,
  fullName: users.fullName,
  avatarUrl: users.avatarUrl,
  universityId: users.universityId,
  campusId: users.campusId,
  studentVerificationStatus: users.studentVerificationStatus,
  accountStatus: users.accountStatus,
};

@Injectable()
export class StaffService {
  constructor(@Inject(DATABASE) private db: Database) {}
  private async user(db: Executor, id: string) {
    const [user] = await db
      .select(userFields)
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!user)
      throw new DomainError("USER_NOT_FOUND", "Account not found.", 404);
    return user;
  }
  async list(query: StaffUsersQuery) {
    if (
      query.status &&
      !["active", "suspended", "deactivated"].includes(query.status)
    )
      throw new DomainError(
        "INVALID_STATUS",
        "Use active, suspended, or deactivated for account status.",
        400,
      );
    return this.db
      .select(userFields)
      .from(users)
      .where(
        and(
          query.email
            ? eq(users.email, query.email.trim().toLowerCase())
            : undefined,
          query.status
            ? eq(
                users.accountStatus,
                query.status as "active" | "suspended" | "deactivated",
              )
            : undefined,
        ),
      )
      .orderBy(users.fullName, users.id)
      .limit(query.limit ?? 20)
      .offset(query.offset ?? 0);
  }
  async one(id: string) {
    return { ...(await this.user(this.db, id)), ...(await this.roles(id)) };
  }
  async roles(id: string) {
    await this.user(this.db, id);
    const rows = await this.db
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(eq(userRoles.userId, id))
      .orderBy(userRoles.role);
    return { userId: id, roles: rows.map((row) => row.role) };
  }
  async change(
    actorId: string,
    userId: string,
    role: StaffRole,
    reason: string,
    grant: boolean,
  ) {
    if (reason.trim().length < 3)
      throw new DomainError(
        "INVALID_REASON",
        "Provide a meaningful reason for the role change.",
        400,
      );
    return this.db.transaction(async (tx) => {
      // Serialize role changes so simultaneous revocations cannot remove the final active administrator.
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext('konet.staff_roles'))`,
      );
      const target = await this.user(tx, userId);
      if (grant && target.accountStatus !== "active")
        throw new DomainError(
          "ACCOUNT_UNAVAILABLE",
          "Roles can only be granted to active accounts.",
          409,
        );
      const [existing] = await tx
        .select()
        .from(userRoles)
        .where(and(eq(userRoles.userId, userId), eq(userRoles.role, role)))
        .limit(1);
      if (
        !grant &&
        existing &&
        role === "admin" &&
        target.accountStatus === "active"
      ) {
        const activeAdmins = await tx
          .select({ userId: userRoles.userId })
          .from(userRoles)
          .innerJoin(users, eq(userRoles.userId, users.id))
          .where(
            and(eq(userRoles.role, "admin"), eq(users.accountStatus, "active")),
          );
        if (activeAdmins.length <= 1)
          throw new DomainError(
            "LAST_ADMIN_REQUIRED",
            "At least one active administrator must remain.",
            409,
          );
      }
      if (grant !== Boolean(existing)) {
        if (grant)
          await tx
            .insert(userRoles)
            .values({ userId, role })
            .onConflictDoNothing();
        else
          await tx
            .delete(userRoles)
            .where(and(eq(userRoles.userId, userId), eq(userRoles.role, role)));
        await tx
          .insert(auditEvents)
          .values({
            actorId,
            action: grant ? "staff_role.granted" : "staff_role.revoked",
            resourceType: "user",
            resourceId: userId,
            reason: reason.trim(),
            details: { role },
          });
      }
      const rows = await tx
        .select({ role: userRoles.role })
        .from(userRoles)
        .where(eq(userRoles.userId, userId))
        .orderBy(userRoles.role);
      return { userId, roles: rows.map((row) => row.role) };
    });
  }
}
