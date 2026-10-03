require("dotenv/config");
const { randomBytes } = require("node:crypto");
const { userInfo } = require("node:os");
const argon2 = require("argon2");
const { Pool } = require("pg");
const { drizzle } = require("drizzle-orm/node-postgres");
const { eq, and } = require("drizzle-orm");
const { universities, campuses, users } = require("../dist/database/schema");
const {
  changeStaffRole,
} = require("../dist/modules/administration/staff-role-policy");
async function main() {
  if (process.env.NODE_ENV !== "development")
    throw Error("Test accounts require development mode.");
  if (!process.env.DATABASE_URL) throw Error("DATABASE_URL is required.");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);
  try {
    const accounts = await db.transaction(async (tx) => {
      const result = [];
      for (const email of [
        "student.test@example.test",
        "admin.test@example.test",
      ]) {
        if (
          (
            await tx
              .select({ id: users.id })
              .from(users)
              .where(eq(users.email, email))
          ).length
        )
          throw Error(
            "Test accounts already exist; credentials will not be overwritten.",
          );
      }
      await tx
        .insert(universities)
        .values({
          name: "Konet Test University",
          shortName: "KONET TEST",
          slug: "konet-test-university",
          city: "Test City",
          state: "Test State",
        })
        .onConflictDoNothing();
      const [university] = await tx
        .select()
        .from(universities)
        .where(eq(universities.slug, "konet-test-university"));
      if (!university.isActive) throw Error("Test university is inactive.");
      await tx
        .insert(campuses)
        .values({
          universityId: university.id,
          name: "Test Campus",
          slug: "test-campus",
        })
        .onConflictDoNothing();
      const [campus] = await tx
        .select()
        .from(campuses)
        .where(
          and(
            eq(campuses.universityId, university.id),
            eq(campuses.slug, "test-campus"),
          ),
        );
      if (!campus.isActive) throw Error("Test campus is inactive.");
      for (const role of ["user", "admin"]) {
        const email =
          role === "admin"
            ? "admin.test@example.test"
            : "student.test@example.test";
        const password = "Konet-" + randomBytes(16).toString("base64url") + "!";
        const passwordHash = await argon2.hash(password, {
          type: argon2.argon2id,
        });
        const [user] = await tx
          .insert(users)
          .values({
            email,
            passwordHash,
            fullName: role === "admin" ? "Test Administrator" : "Test Student",
            universityId: university.id,
            campusId: campus.id,
            studentVerificationStatus: "verified",
            emailVerifiedAt: new Date(),
          })
          .returning({ id: users.id });
        result.push({ id: user.id, email, password, role });
      }
      return result;
    });
    const admin = accounts.find((a) => a.role === "admin");
    await changeStaffRole(db, {
      actorId: null,
      userId: admin.id,
      role: "admin",
      grant: true,
      reason: "Explicitly requested development test administrator",
      operator: userInfo().username,
    });
    console.log(
      JSON.stringify(
        accounts.map(({ email, password, role }) => ({
          email,
          password,
          role,
        })),
        null,
        2,
      ),
    );
  } finally {
    await pool.end();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
