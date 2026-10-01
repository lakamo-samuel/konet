require("dotenv/config");
const { Pool } = require("pg");
const { drizzle } = require("drizzle-orm/node-postgres");
const { and, eq, sql } = require("drizzle-orm");
const { users, userRoles, auditEvents } = require("../dist/database/schema");

async function main() {
  const [action, rawEmail, role] = process.argv.slice(2);
  if (
    !["grant", "revoke"].includes(action) ||
    !rawEmail ||
    !["admin", "reviewer", "support", "finance"].includes(role)
  )
    throw new Error(
      "Usage: npm run staff:role -- <grant|revoke> <existing-account-email> <admin|reviewer|support|finance>",
    );
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: true }
        : undefined,
  });
  try {
    const db = drizzle(pool);
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext('konet.staff_roles'))`,
      );
      const [user] = await tx
        .select({ id: users.id, status: users.accountStatus })
        .from(users)
        .where(eq(users.email, rawEmail.trim().toLowerCase()))
        .limit(1)
        .for("update");
      if (!user) throw new Error("Account not found; register it first.");
      if (action === "grant" && user.status !== "active")
        throw new Error("Roles can only be granted to active accounts.");
      const changed =
        action === "grant"
          ? await tx
              .insert(userRoles)
              .values({ userId: user.id, role })
              .onConflictDoNothing()
              .returning()
          : await tx
              .delete(userRoles)
              .where(
                and(eq(userRoles.userId, user.id), eq(userRoles.role, role)),
              )
              .returning();
      if (changed.length)
        await tx.insert(auditEvents).values({
          actorId: null,
          action:
            action === "grant" ? "staff_role.granted" : "staff_role.revoked",
          resourceType: "user",
          resourceId: user.id,
          reason: "Trusted server operator command",
          details: { role, source: "staff-role-cli" },
        });
      console.log(
        changed.length
          ? "Staff role updated and audited."
          : "No role change needed.",
      );
    });
  } finally {
    await pool.end();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
