import "dotenv/config";
import * as argon2 from "argon2";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  campuses,
  jobs,
  payments,
  portfolioItems,
  providerProfiles,
  providerVerifications,
  quotes,
  reviews,
  serviceCategories,
  serviceRequests,
  services,
  universities,
  users,
} from "./schema";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);
  try {
    await db
      .insert(universities)
      .values([
        {
          name: "Federal University of Technology, Minna",
          shortName: "FUT Minna",
          slug: "fut-minna",
          city: "Minna",
          state: "Niger",
          country: "Nigeria",
        },
        {
          name: "University of Lagos",
          shortName: "UNILAG",
          slug: "unilag",
          city: "Lagos",
          state: "Lagos",
          country: "Nigeria",
        },
        {
          name: "University of Nigeria, Nsukka",
          shortName: "UNN",
          slug: "unn",
          city: "Nsukka",
          state: "Enugu",
          country: "Nigeria",
        },
      ])
      .onConflictDoNothing();
    const schools = await db.select().from(universities);
    for (const university of schools)
      await db
        .insert(campuses)
        .values({
          universityId: university.id,
          name: "Main Campus",
          slug: "main",
        })
        .onConflictDoNothing();
    const categoryNames = [
      "Beauty & Grooming",
      "Photography & Video",
      "Design & Creative",
      "Development & Tech",
      "Tutoring & Academic Support",
      "Writing & Editing",
      "Repairs & Technical Support",
      "Fashion & Tailoring",
      "Events & Entertainment",
      "Business & Marketing",
    ];
    await db
      .insert(serviceCategories)
      .values(
        categoryNames.map((name) => ({
          name,
          slug: name.toLowerCase().replace(/ & /g, "-").replace(/ /g, "-"),
        })),
      )
      .onConflictDoNothing();
    const categories = await db.select().from(serviceCategories);
    const mainCampuses = await db.select().from(campuses);
    const passwordHash = await argon2.hash("KonetDemo123!", {
      type: argon2.argon2id,
    });
    const people = [
      {
        email: "aisha.provider@example.test",
        fullName: "Aisha Bello",
        school: "unilag",
      },
      {
        email: "chinedu.provider@example.test",
        fullName: "Chinedu Okafor",
        school: "unn",
      },
      {
        email: "samuel.client@example.test",
        fullName: "Samuel Adeyemi",
        school: "fut-minna",
      },
    ];
    for (const person of people) {
      const university = schools.find((s) => s.slug === person.school)!;
      const campus = mainCampuses.find(
        (c) => c.universityId === university.id,
      )!;
      await db
        .insert(users)
        .values({
          email: person.email,
          passwordHash,
          fullName: person.fullName,
          universityId: university.id,
          campusId: campus.id,
          studentVerificationStatus: "verified",
          emailVerifiedAt: new Date(),
        })
        .onConflictDoNothing();
    }
    const seededUsers = await db.select().from(users);
    const providerSeeds = [
      {
        email: "aisha.provider@example.test",
        title: "Portrait and event photographer",
        bio: "Student photographer creating warm portraits, graduation coverage, and dependable event galleries.",
        category: "photography-video",
        service: "Campus portraits and event photography",
        price: 2000000,
      },
      {
        email: "chinedu.provider@example.test",
        title: "Web developer and technical tutor",
        bio: "I build responsive web applications and help students understand practical frontend development.",
        category: "development-tech",
        service: "Responsive website development",
        price: 7500000,
      },
    ];
    for (const seed of providerSeeds) {
      const user = seededUsers.find((u) => u.email === seed.email)!;
      await db
        .insert(providerProfiles)
        .values({
          userId: user.id,
          professionalTitle: seed.title,
          bio: seed.bio,
          status: "active",
        })
        .onConflictDoNothing();
      const [provider] = await db
        .select()
        .from(providerProfiles)
        .where(eq(providerProfiles.userId, user.id))
        .limit(1);
      for (const dimension of ["student", "identity", "work"])
        await db
          .insert(providerVerifications)
          .values({
            providerId: provider.id,
            dimension,
            status: "verified",
            decidedAt: new Date(),
          })
          .onConflictDoNothing();
      const category = categories.find((c) => c.slug === seed.category)!;
      const existingService = await db
        .select()
        .from(services)
        .where(eq(services.providerId, provider.id))
        .limit(1);
      if (!existingService.length)
        await db
          .insert(services)
          .values({
            providerId: provider.id,
            categoryId: category.id,
            title: seed.service,
            description: `${seed.service} delivered by a verified student provider with a clear agreed scope.`,
            pricingType: "starting_from",
            priceMinor: seed.price,
            status: "active",
          });
      const existingPortfolio = await db
        .select()
        .from(portfolioItems)
        .where(eq(portfolioItems.providerId, provider.id))
        .limit(1);
      if (!existingPortfolio.length)
        await db
          .insert(portfolioItems)
          .values({
            providerId: provider.id,
            type: "project",
            title: `${seed.service} sample`,
            description: "Representative development portfolio item.",
          });
    }
    const client = seededUsers.find(
      (u) => u.email === "samuel.client@example.test",
    )!;
    const aisha = seededUsers.find(
      (u) => u.email === "aisha.provider@example.test",
    )!;
    const [provider] = await db
      .select()
      .from(providerProfiles)
      .where(eq(providerProfiles.userId, aisha.id))
      .limit(1);
    const [service] = await db
      .select()
      .from(services)
      .where(eq(services.providerId, provider.id))
      .limit(1);
    const priorRequest = await db
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.clientId, client.id))
      .limit(1);
    if (!priorRequest.length) {
      const [request] = await db
        .insert(serviceRequests)
        .values({
          clientId: client.id,
          providerId: provider.id,
          serviceId: service.id,
          description:
            "Graduation portrait session with edited digital photographs.",
          budgetMinMinor: 1800000,
          budgetMaxMinor: 2500000,
          status: "converted_to_job",
        })
        .returning();
      const [quote] = await db
        .insert(quotes)
        .values({
          requestId: request.id,
          providerId: provider.id,
          clientId: client.id,
          amountMinor: 2200000,
          scope: ["Two-hour session", "Fifteen edited photographs"],
          status: "accepted",
          expiresAt: new Date(Date.now() + 86400000),
        })
        .returning();
      const [job] = await db
        .insert(jobs)
        .values({
          requestId: request.id,
          quoteId: quote.id,
          clientId: client.id,
          providerId: provider.id,
          serviceId: service.id,
          agreedAmountMinor: quote.amountMinor,
          status: "completed",
          startedAt: new Date(),
          providerCompletedAt: new Date(),
          clientConfirmedAt: new Date(),
          completedAt: new Date(),
        })
        .returning();
      await db
        .insert(payments)
        .values({
          jobId: job.id,
          payerId: client.id,
          providerId: provider.id,
          amountMinor: quote.amountMinor,
          providerAmountMinor: quote.amountMinor,
          idempotencyKey: `seed:${job.id}`,
          status: "released",
        });
      await db
        .insert(reviews)
        .values({
          jobId: job.id,
          clientId: client.id,
          providerId: provider.id,
          rating: 5,
          comment: "Clear communication and excellent graduation photographs.",
        });
    }
    console.log("Multi-university development seed applied.");
  } finally {
    await pool.end();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
