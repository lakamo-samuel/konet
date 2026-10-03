import { changeStaffRole } from "./staff-role-policy";
import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DATABASE, Database } from "../../database/database.module";
import { userRoles, users } from "../../database/schema";
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
    return changeStaffRole(this.db, { actorId, userId, role, reason, grant });
  }
}
