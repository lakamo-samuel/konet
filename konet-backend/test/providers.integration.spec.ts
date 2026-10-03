import "reflect-metadata";
import { Test } from "@nestjs/testing";
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from "@nestjs/common";
import { ThrottlerStorage } from "@nestjs/throttler";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import request = require("supertest");
import * as schema from "../src/database/schema";
import { DATABASE } from "../src/database/database.module";
import { AuthService } from "../src/modules/auth/auth.service";
import { CloudinaryGateway } from "../src/modules/uploads/cloudinary.gateway";
import { DomainExceptionFilter } from "../src/common/filters/domain-exception.filter";
process.env.NODE_ENV = "test";
process.env.STAFF_MFA_REQUIRED = "false";
process.env.LOG_LEVEL = "silent";
process.env.JWT_ACCESS_SECRET = "providers-access-secret-is-long-and-unique";
process.env.JWT_REFRESH_SECRET = "providers-refresh-secret-is-long-and-unique";
process.env.DATABASE_URL =
  "postgresql://offline:offline@localhost:5432/offline";
process.env.FRONTEND_URL = "http://localhost:3000";
const { AppModule } =
  require("../src/app.module") as typeof import("../src/app.module");
const describeDatabase = process.env.AUTH_TEST_DB_SOCKET
  ? describe
  : describe.skip;
describeDatabase("provider onboarding PostgreSQL API integration", () => {
  const pool = new Pool({
    host: process.env.AUTH_TEST_DB_SOCKET,
    port: 55437,
    database: "konet_providers_test",
  });
  const db = drizzle(pool, { schema });
  let app: INestApplication;
  let student: { id: string; token: string };
  let reviewer: { id: string; token: string };
  let other: { id: string; token: string };
  let categoryId: string;
  const gateway = {
    configured: () => true,
    requireConfigured: () => {},
    ticket: (publicId: string) => ({
      uploadUrl: "https://test.invalid/upload",
      method: "POST",
      fields: { public_id: publicId },
      headers: {},
    }),
    inspect: jest.fn(),
    download: jest.fn(() => ({
      downloadUrl: "https://test.invalid/private",
      expiresAt: new Date(Date.now() + 300000),
    })),
    destroy: jest.fn(async () => {}),
  };
  const profileInput = {
    professionalTitle: "Student photographer",
    bio: "I provide event photography and editing for students on campus.",
    responseTimeMinutes: 60,
  };
  beforeAll(async () => {
    const admin = new Pool({
      host: process.env.AUTH_TEST_DB_SOCKET,
      port: 55437,
      database: "postgres",
    });
    try {
      if (
        !(
          await admin.query(
            "SELECT 1 FROM pg_database WHERE datname = 'konet_providers_test'",
          )
        ).rowCount
      )
        await admin.query('CREATE DATABASE "konet_providers_test"');
    } finally {
      await admin.end();
    }
    await migrate(db, { migrationsFolder: "src/database/migrations" });
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DATABASE)
      .useValue(db)
      .overrideProvider(ThrottlerStorage)
      .useValue({
        increment: async () => ({
          totalHits: 1,
          timeToExpire: 60,
          isBlocked: false,
          timeToBlockExpire: 0,
        }),
      })
      .overrideProvider(CloudinaryGateway)
      .useValue(gateway)
      .compile();
    app = module.createNestApplication({ logger: false });
    app.setGlobalPrefix("api");
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.listen(0, "127.0.0.1");
  });
  beforeEach(async () => {
    jest.clearAllMocks();
    await pool.query(
      'TRUNCATE TABLE "users", "universities", "service_categories" CASCADE',
    );
    const [university] = await db
      .insert(schema.universities)
      .values({
        name: "Test University",
        shortName: "TEST",
        slug: "test",
        city: "Lagos",
        state: "Lagos",
      })
      .returning();
    const [campus] = await db
      .insert(schema.campuses)
      .values({ universityId: university.id, name: "Main", slug: "main" })
      .returning();
    const auth = app.get(AuthService);
    const account = async (email: string) => {
      const result = await auth.register({
        email,
        password: "provider-test-password",
        fullName: "Test Account",
        universityId: university.id,
        campusId: campus.id,
      });
      await db
        .update(schema.users)
        .set({ studentVerificationStatus: "verified" })
        .where(eq(schema.users.id, result.user.id));
      return { id: result.user.id, token: result.accessToken };
    };
    student = await account("student@example.com");
    reviewer = await account("reviewer@example.com");
    other = await account("other@example.com");
    await db
      .insert(schema.userRoles)
      .values({ userId: reviewer.id, role: "reviewer" });
    const [category] = await db
      .insert(schema.serviceCategories)
      .values({ name: "Photography", slug: "photography" })
      .returning();
    categoryId = category.id;
    gateway.inspect.mockImplementation(async (publicId: string) => ({
      public_id: publicId,
      asset_id: "asset",
      version: 1,
      bytes: 1234,
      format: "pdf",
      resource_type: "image",
      type: "authenticated",
      moderation: [{ kind: "perception_point", status: "approved" }],
    }));
  });
  afterAll(async () => {
    await app?.close();
    await pool.end();
  });
  function api(method: string, path: string, token = student.token) {
    const client = request(app.getHttpServer()) as any;
    return client[method](`/api/v1/${path}`).set(
      "Authorization",
      `Bearer ${token}`,
    );
  }
  async function upload(token = student.token, purpose = "provider_evidence") {
    const ticket = await api("post", "uploads/presign", token)
      .send({
        purpose,
        fileName: "evidence.pdf",
        contentType: "application/pdf",
        sizeBytes: 1234,
      })
      .expect(201);
    await api(
      "post",
      `uploads/${ticket.body.upload.id}/complete`,
      token,
    ).expect(202);
    return ticket.body.upload as { id: string; objectKey: string };
  }
  async function evidence(dimension: string, token = student.token) {
    const file = await upload(token);
    const result = await api("post", "me/provider-verifications", token)
      .send({ dimension, evidenceObjectKey: file.objectKey })
      .expect(201);
    return { file, verification: result.body };
  }
  async function setup(token = student.token) {
    const profile = (
      await api("post", "me/provider-profile", token)
        .send(profileInput)
        .expect(201)
    ).body;
    const service = (
      await api("post", "services", token)
        .send({
          categoryId,
          title: "Event photography",
          description:
            "Photography for student events with editing and delivery.",
          pricingType: "fixed",
          priceMinor: 500000,
          currency: "NGN",
        })
        .expect(201)
    ).body;
    const identity = await evidence("identity", token);
    const work = await evidence("work", token);
    return { profile, service, identity, work };
  }
  async function approveEvidence(id: string, revision = 1) {
    return api(
      "post",
      `admin/provider-verifications/${id}/decision`,
      reviewer.token,
    )
      .send({
        decision: "verified",
        reason: "Document and supporting evidence checked.",
        revision,
      })
      .expect(201);
  }
  async function approved() {
    const state = await setup();
    const submitted = await api("post", "me/provider-profile/submit").expect(
      202,
    );
    await approveEvidence(state.identity.verification.id);
    await approveEvidence(state.work.verification.id);
    await api(
      "post",
      `admin/providers/${state.profile.id}/decision`,
      reviewer.token,
    )
      .send({
        decision: "active",
        reason: "Identity and work checks passed.",
        revision: submitted.body.reviewRevision,
      })
      .expect(201);
    return state;
  }
  it("requires a verified student, and creates profile plus dimensions atomically under concurrent requests", async () => {
    expect(
      (await api("get", "me/provider-onboarding").expect(200)).body.profile,
    ).toBeNull();
    await db
      .update(schema.users)
      .set({ studentVerificationStatus: "unverified" })
      .where(eq(schema.users.id, student.id));
    await api("post", "me/provider-profile").send(profileInput).expect(403);
    expect(await db.select().from(schema.providerProfiles)).toHaveLength(0);
    await db
      .update(schema.users)
      .set({ studentVerificationStatus: "verified" })
      .where(eq(schema.users.id, student.id));
    const results = await Promise.all([
      api("post", "me/provider-profile").send(profileInput),
      api("post", "me/provider-profile").send(profileInput),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await db.select().from(schema.providerVerifications)).toHaveLength(
      3,
    );
  });
  it("supports draft services and keeps every unapproved public view hidden", async () => {
    const state = await setup();
    expect(state.service.status).toBe("draft");
    await api("post", "me/provider-profile/publish").expect(403);
    await api("patch", `me/services/${state.service.id}`)
      .send({ status: "active" })
      .expect(403);
    await api("get", `providers/${state.profile.id}`).expect(404);
    await api("get", `providers/${state.profile.id}/portfolio`).expect(404);
    await api("get", `services/${state.service.id}`).expect(404);
    expect((await api("get", "providers").expect(200)).body).toEqual([]);
  });
  it("requires both identity and work, a service, and staff approval; CAC stays optional", async () => {
    const profile = await api("post", "me/provider-profile")
      .send(profileInput)
      .expect(201);
    await evidence("identity");
    await api("post", "me/provider-profile/submit").expect(409);
    await evidence("work");
    await api("post", "me/provider-profile/submit").expect(409);
    await api(
      "post",
      `admin/providers/${profile.body.id}/decision`,
      reviewer.token,
    )
      .send({
        decision: "active",
        reason: "No pending submission.",
        revision: 1,
      })
      .expect(409);
  });
  it("separates evidence review, overall approval, publishing, service activation and pausing", async () => {
    const state = await setup();
    const submitted = await api("post", "me/provider-profile/submit").expect(
      202,
    );
    await api(
      "post",
      `admin/providers/${state.profile.id}/decision`,
      reviewer.token,
    )
      .send({
        decision: "active",
        reason: "Evidence still pending.",
        revision: 1,
      })
      .expect(409);
    await api("patch", "me/provider-profile")
      .send({ bio: profileInput.bio })
      .expect(409);
    await api("post", "services")
      .send({
        categoryId,
        title: "Another service",
        description:
          "This service must not be added while a reviewer is checking.",
        pricingType: "fixed",
        priceMinor: 1000,
      })
      .expect(409);
    const pending = await api("get", "admin/providers", reviewer.token).expect(
      200,
    );
    expect(pending.body[0].id).toBe(state.profile.id);
    const dimensions = await api(
      "get",
      "admin/provider-verifications",
      reviewer.token,
    ).expect(200);
    expect(dimensions.body).toHaveLength(2);
    await approveEvidence(state.identity.verification.id);
    await approveEvidence(state.work.verification.id);
    await api(
      "post",
      `admin/providers/${state.profile.id}/decision`,
      reviewer.token,
    )
      .send({
        decision: "active",
        reason: "Identity and work checked.",
        revision: submitted.body.reviewRevision,
      })
      .expect(201);
    const draft = await api("get", "me/provider-profile").expect(200);
    expect(draft.body.reviewStatus).toBe("approved");
    expect(draft.body.status).toBe("draft");
    await api("get", `providers/${state.profile.id}`).expect(404);
    await api("post", "me/provider-profile/publish").expect(200);
    await api("patch", `me/services/${state.service.id}`)
      .send({ status: "active" })
      .expect(200);
    await api("get", `providers/${state.profile.id}`).expect(200);
    await api("get", `services/${state.service.id}`).expect(200);
    const badges = await api("get", "me/provider-verifications").expect(200);
    expect(badges.body.find((v: any) => v.dimension === "cac").status).toBe(
      "not_submitted",
    );
    expect(badges.body[0]).not.toHaveProperty("evidenceObjectKey");
    await api("patch", "me/provider-profile/status")
      .send({ status: "paused" })
      .expect(200);
    await api("get", `providers/${state.profile.id}`).expect(404);
    await api("get", `services/${state.service.id}`).expect(404);
    expect((await api("get", "services").expect(200)).body).toEqual([]);
    await api("patch", "me/provider-profile/status")
      .send({ status: "active" })
      .expect(200);
    await api("get", `providers/${state.profile.id}/services`).expect(200);
  });
  it("enforces evidence ownership, purpose, retention, and reviewer-only access to attachments", async () => {
    await api("post", "me/provider-profile").send(profileInput).expect(201);
    const foreign = await upload(other.token);
    await api("post", "me/provider-verifications")
      .send({ dimension: "identity", evidenceObjectKey: foreign.objectKey })
      .expect(409);
    const wrong = await upload(student.token, "student_evidence");
    await api("post", "me/provider-verifications")
      .send({ dimension: "identity", evidenceObjectKey: wrong.objectKey })
      .expect(409);
    const proof = await evidence("identity");
    await api(
      "get",
      `uploads/${proof.file.id}/download`,
      reviewer.token,
    ).expect(200);
    await api("get", `uploads/${proof.file.id}/download`, other.token).expect(
      403,
    );
    await api("delete", `uploads/${proof.file.id}`).expect(409);
    await db
      .update(schema.uploads)
      .set({ retainUntil: new Date(Date.now() - 1000) })
      .where(eq(schema.uploads.id, proof.file.id));
    await api(
      "post",
      `admin/provider-verifications/${proof.verification.id}/decision`,
      reviewer.token,
    )
      .send({ decision: "verified", reason: "Evidence expired.", revision: 1 })
      .expect(409);
    await api("get", "admin/provider-verifications").expect(403);
    await api("get", "admin/providers", other.token).expect(403);
  });
  it("prevents self-review of evidence and profiles", async () => {
    const state = await setup(reviewer.token);
    await api("post", "me/provider-profile/submit", reviewer.token).expect(202);
    await api(
      "post",
      `admin/provider-verifications/${state.identity.verification.id}/decision`,
      reviewer.token,
    )
      .send({ decision: "verified", reason: "My own document.", revision: 1 })
      .expect(403);
    await api(
      "post",
      `admin/providers/${state.profile.id}/decision`,
      reviewer.token,
    )
      .send({ decision: "active", reason: "My own profile.", revision: 1 })
      .expect(403);
  });
  it("allows only one concurrent evidence decision and records a reason, notification and audit", async () => {
    const state = await setup();
    const responses = await Promise.all(
      ["verified", "rejected"].map((decision) =>
        api(
          "post",
          `admin/provider-verifications/${state.identity.verification.id}/decision`,
          reviewer.token,
        ).send({
          decision,
          reason: "Concurrent review decision.",
          revision: 1,
        }),
      ),
    );
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    const records = await db.select().from(schema.providerReviewDecisions);
    expect(records).toHaveLength(1);
    expect(await db.select().from(schema.notifications)).toHaveLength(1);
    expect(
      await db
        .select()
        .from(schema.auditEvents)
        .where(eq(schema.auditEvents.action, "provider_verification.decided")),
    ).toHaveLength(1);
  });
  it("returns pending profile for correction when required evidence is rejected and guards against stale decisions after resubmission", async () => {
    const state = await setup();
    await api("post", "me/provider-profile/submit").expect(202);
    await api(
      "post",
      `admin/provider-verifications/${state.identity.verification.id}/decision`,
      reviewer.token,
    )
      .send({
        decision: "requires_more_information",
        reason: "Please upload a clearer card.",
        revision: 1,
      })
      .expect(201);
    const own = await api("get", "me/provider-profile").expect(200);
    expect(own.body.reviewStatus).toBe("requires_more_information");
    expect(own.body.reviewReason).toBe("Please upload a clearer card.");
    const replacement = await evidence("identity");
    expect(replacement.verification.revision).toBe(2);
    await api("post", "me/provider-profile/submit").expect(202);
    await api(
      "post",
      `admin/provider-verifications/${replacement.verification.id}/decision`,
      reviewer.token,
    )
      .send({
        decision: "verified",
        reason: "Stale evidence form.",
        revision: 1,
      })
      .expect(409);
    await approveEvidence(replacement.verification.id, 2);
    await approveEvidence(state.work.verification.id);
    await api(
      "post",
      `admin/providers/${state.profile.id}/decision`,
      reviewer.token,
    )
      .send({ decision: "active", reason: "Stale profile form.", revision: 1 })
      .expect(409);
    await api(
      "post",
      `admin/providers/${state.profile.id}/decision`,
      reviewer.token,
    )
      .send({
        decision: "active",
        reason: "Current profile checked.",
        revision: 2,
      })
      .expect(201);
    const detail = await api(
      "get",
      `admin/provider-verifications/${replacement.verification.id}`,
      reviewer.token,
    ).expect(200);
    expect(detail.body.submissions).toHaveLength(2);
    expect(detail.body.decisions).toHaveLength(2);
  });
  it("permits one concurrent overall decision and rejects direct approval field injection", async () => {
    const state = await setup();
    await api("post", "me/provider-profile/submit").expect(202);
    await approveEvidence(state.identity.verification.id);
    await approveEvidence(state.work.verification.id);
    const results = await Promise.all(
      ["active", "rejected"].map((decision) =>
        api(
          "post",
          `admin/providers/${state.profile.id}/decision`,
          reviewer.token,
        ).send({ decision, reason: "Overall review decision.", revision: 1 }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    await api("patch", "me/provider-profile")
      .send({ approvedAt: new Date().toISOString(), status: "active" })
      .expect(400);
  });
  it("invalidates approval and unpublishes on public profile/portfolio changes, while availability remains editable", async () => {
    const state = await approved();
    await api("post", "me/provider-profile/publish").expect(200);
    await api("patch", "me/provider-profile")
      .send({ availability: "limited" })
      .expect(200);
    await api("get", `providers/${state.profile.id}`).expect(200);
    const updated = await api("patch", "me/provider-profile")
      .send({ professionalTitle: "Student video editor" })
      .expect(200);
    expect(updated.body.approvedAt).toBeNull();
    expect(updated.body.status).toBe("draft");
    await api("get", `providers/${state.profile.id}`).expect(404);
    await api("post", "me/provider-profile/publish").expect(403);
  });
  it("saves typed form drafts but never treats them as canonical evidence or service records", async () => {
    await api("post", "me/provider-profile").send(profileInput).expect(201);
    const saved = await api("patch", "me/provider-onboarding/steps/services")
      .send({
        values: {
          title: "Saved form title",
          description:
            "A draft description with enough detail to keep for later.",
          categoryId,
          pricingType: "fixed",
          priceMinor: 1200,
        },
      })
      .expect(200);
    expect(saved.body.steps.services.values.title).toBe("Saved form title");
    expect(saved.body.services).toEqual([]);
    expect(saved.body.canSubmit).toBe(false);
    await api("patch", "me/provider-onboarding/steps/preview")
      .send({ values: { ready: true, status: "active" } })
      .expect(400);
    await api("patch", "me/provider-onboarding/steps/profile")
      .send({ values: { approvedAt: new Date().toISOString() } })
      .expect(400);
    await api("patch", "me/provider-onboarding/steps/constructor")
      .send({ values: {} })
      .expect(400);
    await api("patch", "me/provider-onboarding/steps/profile")
      .send({ values: { bio: null } })
      .expect(400);
  });
  it("keeps portfolio owner-only before publication and refuses private evidence URLs", async () => {
    const state = await setup();
    const item = await api("post", "me/portfolio")
      .send({
        type: "external_link",
        title: "Campus photo project",
        externalUrl: "https://example.com/project",
      })
      .expect(201);
    await api("get", `providers/${state.profile.id}/portfolio`).expect(404);
    await api("patch", `me/portfolio/${item.body.id}`, other.token)
      .send({ title: "Wrong owner" })
      .expect(404);
    await api("post", "me/portfolio")
      .send({
        type: "image",
        title: "Private evidence",
        assetUrl:
          "https://res.cloudinary.com/cloud/image/authenticated/student-evidence/id.pdf",
      })
      .expect(400);
    await api("post", "me/portfolio")
      .send({ type: "image", title: "Missing image" })
      .expect(400);
    await api("patch", `me/portfolio/${item.body.id}`)
      .send({ title: null })
      .expect(400);
    await api("delete", `me/portfolio/${item.body.id}`).expect(204);
    expect((await api("get", "me/portfolio").expect(200)).body).toEqual([]);
  });
  it("rechecks student status and prevents suspended provider reactivation", async () => {
    const state = await approved();
    await db
      .update(schema.users)
      .set({ studentVerificationStatus: "rejected" })
      .where(eq(schema.users.id, student.id));
    await api("post", "me/provider-profile/publish").expect(403);
    await db
      .update(schema.users)
      .set({ studentVerificationStatus: "verified" })
      .where(eq(schema.users.id, student.id));
    await db
      .update(schema.providerProfiles)
      .set({ status: "suspended" })
      .where(eq(schema.providerProfiles.id, state.profile.id));
    await api("patch", "me/provider-profile/status")
      .send({ status: "active" })
      .expect(403);
  });
  it("blocks invalid service prices and service ownership violations", async () => {
    const state = await setup();
    await api("post", "services")
      .send({
        categoryId,
        title: "Invalid currency",
        description: "This is an invalid service with unsupported currency.",
        pricingType: "fixed",
        priceMinor: 1000,
        currency: "USD",
      })
      .expect(400);
    await api("post", "services")
      .send({
        categoryId,
        title: "No price",
        description:
          "A priced service must supply a positive minor-unit amount.",
        pricingType: "fixed",
      })
      .expect(400);
    await api("patch", `me/services/${state.service.id}`, other.token)
      .send({ title: "Wrong provider" })
      .expect(404);
    await api("patch", `me/services/${state.service.id}`)
      .send({ title: null })
      .expect(400);
  });
  it("rejects direct hiring of a published provider whose account is no longer eligible", async () => {
    const state = await approved();
    await api("post", "me/provider-profile/publish").expect(200);
    await api("patch", `me/services/${state.service.id}`)
      .send({ status: "active" })
      .expect(200);
    await db
      .update(schema.users)
      .set({ studentVerificationStatus: "rejected" })
      .where(eq(schema.users.id, student.id));
    await api("get", `providers/${state.profile.id}`, other.token).expect(404);
    await api("post", "requests", other.token)
      .send({
        providerId: state.profile.id,
        serviceId: state.service.id,
        description: "Hire for a campus event with editing and photos.",
      })
      .expect(404);
  });
  it("filters discovery by the same active service and validates pagination and literal text", async () => {
    const state = await approved();
    await api("post", "me/provider-profile/publish").expect(200);
    await api("patch", `me/services/${state.service.id}`)
      .send({ status: "active" })
      .expect(200);
    const [secondCategory] = await db
      .insert(schema.serviceCategories)
      .values({ name: "Video", slug: "video" })
      .returning();
    await db
      .insert(schema.services)
      .values({
        providerId: state.profile.id,
        categoryId: secondCategory.id,
        title: "Budget video",
        description: "Another active service used to test a combined filter.",
        pricingType: "fixed",
        priceMinor: 1000,
        status: "active",
      });
    expect(
      (
        await api(
          "get",
          `providers?categoryId=${categoryId}&maxPriceMinor=1000`,
        ).expect(200)
      ).body,
    ).toEqual([]);
    expect(
      (
        await api(
          "get",
          `providers?categoryId=${secondCategory.id}&maxPriceMinor=1000`,
        ).expect(200)
      ).body,
    ).toHaveLength(1);
    expect((await api("get", "providers?query=%25").expect(200)).body).toEqual(
      [],
    );
    expect(
      (
        await api(
          "get",
          `services?maxPriceMinor=1000&categoryId=${secondCategory.id}&limit=1`,
        ).expect(200)
      ).body,
    ).toHaveLength(1);
    expect(
      (await api("get", "services?limit=1&offset=1").expect(200)).body,
    ).toHaveLength(1);
    await api("get", "providers?limit=101").expect(400);
    await api("get", "services?maxPriceMinor=-1").expect(400);
  });
  it("manages categories with admin permission, rejects cycles, and hides inactive subtrees everywhere", async () => {
    await api("post", "admin/categories")
      .send({ name: "Design", slug: "design" })
      .expect(403);
    await api("post", "admin/categories", reviewer.token)
      .send({ name: "Design", slug: "design" })
      .expect(403);
    await db
      .insert(schema.userRoles)
      .values({ userId: reviewer.id, role: "admin" });
    const parent = (
      await api("post", "admin/categories", reviewer.token)
        .send({ name: "Creative", slug: "Creative" })
        .expect(201)
    ).body;
    const child = (
      await api("post", "admin/categories", reviewer.token)
        .send({ name: "Design", slug: "design", parentId: parent.id })
        .expect(201)
    ).body;
    await api("patch", `admin/categories/${parent.id}`, reviewer.token)
      .send({ parentId: child.id })
      .expect(409);
    await api("post", "admin/categories", reviewer.token)
      .send({ name: "Duplicate", slug: "design" })
      .expect(409);
    await api("patch", `admin/categories/${child.id}`, reviewer.token)
      .send({ isActive: "false" })
      .expect(400);
    await api("patch", `admin/categories/${child.id}`, reviewer.token)
      .send({ parentId: null })
      .expect(200);
    await api("patch", `admin/categories/${child.id}`, reviewer.token)
      .send({ parentId: parent.id })
      .expect(200);
    const state = await approved();
    await api("post", "me/provider-profile/publish").expect(200);
    await api("patch", `me/services/${state.service.id}`)
      .send({ status: "active" })
      .expect(200);
    await db
      .update(schema.services)
      .set({ categoryId: child.id })
      .where(eq(schema.services.id, state.service.id));
    await api("get", `services/${state.service.id}`).expect(200);
    await api("patch", `admin/categories/${parent.id}`, reviewer.token)
      .send({ isActive: false })
      .expect(200);
    await api("get", `services/${state.service.id}`).expect(404);
    expect(
      (await api("get", `providers/${state.profile.id}/services`).expect(200))
        .body,
    ).toEqual([]);
    expect(
      (await api("get", `providers?categoryId=${child.id}`).expect(200)).body,
    ).toEqual([]);
    const categories = (await api("get", "categories").expect(200)).body;
    expect(categories.some((c: any) => c.id === child.id)).toBe(false);
  });
});
