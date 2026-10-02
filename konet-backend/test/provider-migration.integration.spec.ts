import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const describeDatabase = process.env.AUTH_TEST_DB_SOCKET
  ? describe
  : describe.skip;
describeDatabase("provider review migration upgrade", () => {
  const options = { host: process.env.AUTH_TEST_DB_SOCKET, port: 55437 };
  const pool = new Pool({
    ...options,
    database: "konet_provider_upgrade_test",
  });
  let directory: string;
  beforeAll(async () => {
    const admin = new Pool({ ...options, database: "postgres" });
    try {
      await admin.query(
        'DROP DATABASE IF EXISTS "konet_provider_upgrade_test"',
      );
      await admin.query('CREATE DATABASE "konet_provider_upgrade_test"');
    } finally {
      await admin.end();
    }
    directory = await mkdtemp(join(tmpdir(), "konet-provider-upgrade-"));
    await mkdir(join(directory, "meta"));
    const journal = JSON.parse(
      await readFile("src/database/migrations/meta/_journal.json", "utf8"),
    );
    journal.entries = journal.entries.filter(
      (entry: { idx: number }) => entry.idx < 4,
    );
    await writeFile(
      join(directory, "meta/_journal.json"),
      JSON.stringify(journal),
    );
    for (const entry of journal.entries)
      await copyFile(
        `src/database/migrations/${entry.tag}.sql`,
        join(directory, `${entry.tag}.sql`),
      );
    await migrate(drizzle(pool), { migrationsFolder: directory });
  });
  afterAll(async () => {
    await pool.end();
    if (directory) await rm(directory, { recursive: true, force: true });
  });
  it("requires documented re-review for legacy provider flags, preserves suspensions, and audits reset profiles", async () => {
    const university = (
      await pool.query(
        "INSERT INTO universities (name, short_name, slug, city, state) VALUES ('Legacy University','LEGACY','legacy','Lagos','Lagos') RETURNING id",
      )
    ).rows[0].id;
    const campus = (
      await pool.query(
        "INSERT INTO campuses (university_id,name,slug) VALUES ($1,'Main','main') RETURNING id",
        [university],
      )
    ).rows[0].id;
    const activeUser = (
      await pool.query(
        "INSERT INTO users (email,password_hash,full_name,university_id,campus_id,student_verification_status) VALUES ('legacy@example.com','test-placeholder','Legacy Student',$1,$2,'verified') RETURNING id",
        [university, campus],
      )
    ).rows[0].id;
    const suspendedUser = (
      await pool.query(
        "INSERT INTO users (email,password_hash,full_name,university_id,campus_id) VALUES ('suspended@example.com','test-placeholder','Suspended Student',$1,$2) RETURNING id",
        [university, campus],
      )
    ).rows[0].id;
    const profile = (
      await pool.query(
        "INSERT INTO provider_profiles (user_id,professional_title,bio,status) VALUES ($1,'Legacy provider','Legacy biography','active') RETURNING id",
        [activeUser],
      )
    ).rows[0].id;
    const suspended = (
      await pool.query(
        "INSERT INTO provider_profiles (user_id,professional_title,bio,status) VALUES ($1,'Suspended provider','Suspended biography','suspended') RETURNING id",
        [suspendedUser],
      )
    ).rows[0].id;
    await pool.query(
      "INSERT INTO provider_verifications (provider_id,dimension,status) VALUES ($1,'identity','verified'),($1,'work','pending')",
      [profile],
    );
    await migrate(drizzle(pool), {
      migrationsFolder: "src/database/migrations",
    });
    const updated = (
      await pool.query("SELECT * FROM provider_profiles WHERE id=$1", [profile])
    ).rows[0];
    expect(updated.status).toBe("draft");
    expect(updated.review_status).toBe("not_submitted");
    expect(updated.approved_at).toBeNull();
    expect(
      (
        await pool.query("SELECT status FROM provider_profiles WHERE id=$1", [
          suspended,
        ])
      ).rows[0].status,
    ).toBe("suspended");
    const evidence = (
      await pool.query(
        "SELECT status, reason FROM provider_verifications WHERE provider_id=$1",
        [profile],
      )
    ).rows;
    expect(
      evidence.every(
        (row) => row.status === "requires_more_information" && row.reason,
      ),
    ).toBe(true);
    const audit = await pool.query(
      "SELECT * FROM audit_events WHERE action='provider_review.migration_reset' AND resource_id=$1",
      [profile],
    );
    expect(audit.rowCount).toBe(1);
    expect(audit.rows[0].actor_id).toBeNull();
    await migrate(drizzle(pool), {
      migrationsFolder: "src/database/migrations",
    });
    expect(
      (
        await pool.query(
          "SELECT id FROM audit_events WHERE action='provider_review.migration_reset'",
        )
      ).rowCount,
    ).toBe(1);
  });
});
