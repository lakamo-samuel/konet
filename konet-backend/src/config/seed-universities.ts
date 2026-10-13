import "dotenv/config";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { campuses, universities } from "../database/schema";
import { universityCatalog } from "./university-catalog";

async function seedUniversityDirectory() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL must be set before seeding universities.");
  }

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  try {
    await db
      .insert(universities)
      .values(
        universityCatalog.map(({ name, shortName, slug, city, state }) => ({
          name,
          shortName,
          slug,
          city,
          state,
          country: "Nigeria",
        })),
      )
      .onConflictDoNothing();

    const savedUniversities = await db.select().from(universities);
    const campusRecords = universityCatalog.flatMap((school) => {
      const university = savedUniversities.find(
        (item) => item.slug === school.slug,
      );
      if (!university) {
        throw new Error(`Seeded university missing: ${school.slug}`);
      }

      return school.campuses.map((name, index) => ({
        universityId: university.id,
        name,
        slug:
          index === 0
            ? "main"
            : name
                .normalize("NFKD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, ""),
      }));
    });

    await db
      .insert(campuses)
      .values(campusRecords)
      .onConflictDoUpdate({
        target: [campuses.universityId, campuses.slug],
        set: { name: sql`excluded.name` },
      });

    console.log(
      `University directory ready: ${universityCatalog.length} catalog entries and ${campusRecords.length} campuses processed.`,
    );
  } finally {
    await pool.end();
  }
}

seedUniversityDirectory().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
