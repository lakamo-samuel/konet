import { and, eq, sql } from "drizzle-orm";
import type { Database } from "../../database/database.module";
import { users, userRoles, auditEvents } from "../../database/schema";
import { DomainError } from "../../common/errors/domain.error";
import type { StaffRole } from "./staff.guard";
export type StaffTransaction = Parameters<
  Parameters<Database["transaction"]>[0]
>[0];
export async function lockStaffRoles(tx: StaffTransaction) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext('konet.staff_roles'))`,
  );
}
export async function assertActiveAdministrator(
  tx: StaffTransaction,
  actorId: string,
) {
  const [actor] = await tx
    .select({ id: users.id })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .where(
      and(
        eq(users.id, actorId),
        eq(users.accountStatus, "active"),
        eq(userRoles.role, "admin"),
      ),
    )
    .limit(1);
  if (!actor)
    throw new DomainError(
      "STAFF_PERMISSION_REQUIRED",
      "An active administrator is required.",
      403,
    );
}
export async function preserveActiveAdministrator(
  tx: StaffTransaction,
  userId: string,
) {
  const active = await tx
    .select({ userId: userRoles.userId })
    .from(userRoles)
    .innerJoin(users, eq(userRoles.userId, users.id))
    .where(and(eq(userRoles.role, "admin"), eq(users.accountStatus, "active")));
  if (active.length === 1 && active[0].userId === userId)
    throw new DomainError(
      "LAST_ADMIN_REQUIRED",
      "At least one active administrator must remain.",
      409,
    );
}
export async function changeStaffRole(
  db: Database,
  input: {
    actorId: string | null;
    userId: string;
    role: StaffRole;
    reason: string;
    grant: boolean;
    operator?: string;
  },
) {
  if (
    !["admin", "reviewer", "support", "finance"].includes(input.role) ||
    input.reason.trim().length < 3 ||
    input.reason.length > 2000
  )
    throw new DomainError(
      "INVALID_ROLE_CHANGE",
      "Choose a supported staff role and provide a reason of 3–2,000 characters.",
      400,
    );
  return db.transaction(async (tx) => {
    await lockStaffRoles(tx);
    if (input.actorId) await assertActiveAdministrator(tx, input.actorId);
    const [target] = await tx
      .select({ id: users.id, status: users.accountStatus })
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1)
      .for("update");
    if (!target)
      throw new DomainError("USER_NOT_FOUND", "Account not found.", 404);
    if (input.grant && target.status !== "active")
      throw new DomainError(
        "ACCOUNT_UNAVAILABLE",
        "Roles can only be granted to active accounts.",
        409,
      );
    const [existing] = await tx
      .select()
      .from(userRoles)
      .where(
        and(eq(userRoles.userId, input.userId), eq(userRoles.role, input.role)),
      )
      .limit(1);
    if (!input.grant && existing && input.role === "admin")
      await preserveActiveAdministrator(tx, input.userId);
    if (input.grant !== Boolean(existing)) {
      if (input.grant)
        await tx
          .insert(userRoles)
          .values({ userId: input.userId, role: input.role })
          .onConflictDoNothing();
      else
        await tx
          .delete(userRoles)
          .where(
            and(
              eq(userRoles.userId, input.userId),
              eq(userRoles.role, input.role),
            ),
          );
      await tx
        .insert(auditEvents)
        .values({
          actorId: input.actorId,
          action: input.grant ? "staff_role.granted" : "staff_role.revoked",
          resourceType: "user",
          resourceId: input.userId,
          reason: input.reason.trim(),
          details: {
            role: input.role,
            ...(!input.actorId
              ? {
                  source: "staff-role-cli",
                  operator: input.operator ?? "trusted-server-operator",
                }
              : {}),
          },
        });
    }
    const rows = await tx
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(eq(userRoles.userId, input.userId))
      .orderBy(userRoles.role);
    return { userId: input.userId, roles: rows.map((r) => r.role) };
  });
}
