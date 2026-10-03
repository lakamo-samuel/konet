require("dotenv/config");
const { Pool } = require("pg");
const { drizzle } = require("drizzle-orm/node-postgres");
const { eq } = require("drizzle-orm");
const { users } = require("../dist/database/schema");
const {
  changeStaffRole,
} = require("../dist/modules/administration/staff-role-policy");
const { userInfo } = require("node:os");

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
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, rawEmail.trim().toLowerCase()))
      .limit(1);
    if (!user) throw new Error("Account not found; register it first.");
    await changeStaffRole(db, {
      actorId: null,
      userId: user.id,
      role,
      grant: action === "grant",
      reason: "Trusted server operator command",
      operator: process.env.STAFF_OPERATOR_LABEL || userInfo().username,
    });
    console.log("Staff role checked and any change audited.");
  } finally {
    await pool.end();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
