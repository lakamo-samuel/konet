import "reflect-metadata";
import { Test } from "@nestjs/testing";
import {
  ValidationPipe,
  VersioningType,
  INestApplication,
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
import { UploadsService } from "../src/modules/uploads/uploads.service";
import { EmailService } from "../src/infrastructure/email/email.service";
import { DomainExceptionFilter } from "../src/common/filters/domain-exception.filter";
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.JWT_ACCESS_SECRET = "verification-access-secret-long-and-unique";
process.env.JWT_REFRESH_SECRET = "verification-refresh-secret-long-and-unique";
process.env.DATABASE_URL =
  "postgresql://offline:offline@localhost:5432/offline";
process.env.FRONTEND_URL = "http://localhost:3000";
process.env.RESEND_API_KEY = "re_test_no_external_delivery";
process.env.EMAIL_FROM = "test@example.com";
process.env.EMAIL_OUTBOX_KEY = "ab".repeat(32);
const { AppModule } =
  require("../src/app.module") as typeof import("../src/app.module");
const describeDatabase = process.env.AUTH_TEST_DB_SOCKET
  ? describe
  : describe.skip;
describeDatabase("student verification PostgreSQL API integration", () => {
  const pool = new Pool({
    host: process.env.AUTH_TEST_DB_SOCKET,
    port: 55437,
    database: "konet_verification_test",
  });
  const db = drizzle(pool, { schema });
  let app: INestApplication;
  let student: { token: string; id: string };
  let reviewer: { token: string; id: string };
  let other: { token: string; id: string };
  let universityId: string;
  let campusId: string;
  const gateway = {
    configured: () => true,
    requireConfigured: jest.fn(),
    ticket: jest.fn((publicId: string) => ({
      uploadUrl: "https://test.invalid/upload",
      method: "POST",
      fields: { public_id: publicId, signature: "test" },
      headers: {},
    })),
    inspect: jest.fn(),
    download: jest.fn(() => ({
      downloadUrl: "https://test.invalid/private",
      expiresAt: new Date(Date.now() + 300000),
    })),
    destroy: jest.fn(async () => {}),
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
            "SELECT 1 FROM pg_database WHERE datname = 'konet_verification_test'",
          )
        ).rowCount
      )
        await admin.query('CREATE DATABASE "konet_verification_test"');
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
    await pool.query('TRUNCATE TABLE "users", "universities" CASCADE');
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
    universityId = university.id;
    const [campus] = await db
      .insert(schema.campuses)
      .values({ universityId, name: "Main", slug: "main" })
      .returning();
    campusId = campus.id;
    await db
      .insert(schema.universityEmailDomains)
      .values({ universityId, domain: "student.example.edu", approved: true });
    const auth = app.get(AuthService);
    const account = async (email: string) => {
      const result = await auth.register({
        email,
        fullName: "Test Student",
        password: "verification-test-password",
        universityId,
        campusId,
      });
      return { token: result.accessToken, id: result.user.id };
    };
    student = await account("student@example.com");
    reviewer = await account("reviewer@example.com");
    other = await account("other@example.com");
    await db
      .insert(schema.userRoles)
      .values({ userId: reviewer.id, role: "reviewer" });
    gateway.inspect.mockImplementation(async (publicId: string) => ({
      public_id: publicId,
      asset_id: "asset-1",
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
  async function challenge(
    token = student.token,
    email = "owner@student.example.edu",
  ) {
    const response = await api(
      "post",
      "me/student-verification/email-challenges",
      token,
    )
      .send({ email })
      .expect(202);
    const [outbox] = await db
      .select()
      .from(schema.emailOutbox)
      .where(
        eq(
          schema.emailOutbox.idempotencyKey,
          `student-verification:${response.body.challengeId}`,
        ),
      );
    const message = app.get(EmailService).decrypt(outbox.payloadCiphertext!);
    const code = message.text.match(/\b\d{6}\b/)![0];
    expect(outbox.payloadCiphertext).not.toContain(code);
    return { challengeId: response.body.challengeId, code };
  }
  async function evidence(token = student.token) {
    const ticket = await api("post", "uploads/presign", token)
      .send({
        purpose: "student_evidence",
        fileName: "id.pdf",
        contentType: "application/pdf",
        sizeBytes: 1234,
      })
      .expect(201);
    expect(ticket.body.method).toBe("POST");
    await api(
      "post",
      `uploads/${ticket.body.upload.id}/complete`,
      token,
    ).expect(202);
    return ticket.body.upload as { id: string; objectKey: string };
  }
  async function submission(token = student.token) {
    const upload = await evidence(token);
    const response = await api("post", "me/student-verification", token)
      .send({
        method: "student_id",
        studentNumber: "TEST/12345",
        evidenceObjectKey: upload.objectKey,
      })
      .expect(201);
    return { upload, verification: response.body };
  }
  it("automatically verifies approved university email, records a decision, and rejects replay", async () => {
    const input = await challenge();
    expect(
      (
        await api("get", "admin/student-verifications", reviewer.token).expect(
          200,
        )
      ).body,
    ).toEqual([]);
    const response = await api(
      "post",
      "me/student-verification/email-challenges/confirm",
    )
      .send(input)
      .expect(200);
    expect(response.body.status).toBe("verified");
    expect(response.body).not.toHaveProperty("verifiedEmail");
    await api("post", "me/student-verification/email-challenges/confirm")
      .send(input)
      .expect(400);
    expect(
      (await db.select().from(schema.verificationDecisions))[0].source,
    ).toBe("university_email");
    expect(await db.select().from(schema.notifications)).toHaveLength(1);
    expect(
      (await api("get", "auth/me").expect(200)).body.studentVerificationStatus,
    ).toBe("verified");
    await api("post", "me/student-verification/email-challenges")
      .send({ email: "again@student.example.edu" })
      .expect(409);
  });
  it("rejects unknown domains and enforces resend cooldown and exhausted attempts", async () => {
    await api("post", "me/student-verification/email-challenges")
      .send({ email: "person@example.com" })
      .expect(400);
    const input = await challenge();
    await api("post", "me/student-verification/email-challenges")
      .send({ email: "owner@student.example.edu" })
      .expect(429);
    const wrong = input.code === "000000" ? "000001" : "000000";
    for (let n = 0; n < 5; n++)
      await api("post", "me/student-verification/email-challenges/confirm")
        .send({ ...input, code: wrong })
        .expect(400);
    await api("post", "me/student-verification/email-challenges/confirm")
      .send(input)
      .expect(400);
    const [row] = await db.select().from(schema.verificationChallenges);
    expect(row.attempts).toBe(5);
    expect(row.consumedAt).not.toBeNull();
  });
  it("rechecks domain approval and campus eligibility when confirming", async () => {
    const input = await challenge();
    await db.update(schema.universityEmailDomains).set({ approved: false });
    await api("post", "me/student-verification/email-challenges/confirm")
      .send(input)
      .expect(400);
    await db.update(schema.universityEmailDomains).set({ approved: true });
    await db
      .update(schema.campuses)
      .set({ isActive: false })
      .where(eq(schema.campuses.id, campusId));
    await api("post", "me/student-verification/email-challenges/confirm")
      .send(input)
      .expect(409);
  });
  it("does not allow two accounts to claim the same university email concurrently", async () => {
    const first = await challenge();
    const second = await challenge(other.token);
    const responses = await Promise.all([
      api("post", "me/student-verification/email-challenges/confirm").send(
        first,
      ),
      api(
        "post",
        "me/student-verification/email-challenges/confirm",
        other.token,
      ).send(second),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await db.select().from(schema.verificationDecisions)).toHaveLength(
      1,
    );
  });
  it("expires codes and invalidates older codes and emails on resend", async () => {
    const first = await challenge();
    await db
      .update(schema.verificationChallenges)
      .set({
        expiresAt: new Date(Date.now() - 1000),
        createdAt: new Date(Date.now() - 61000),
      })
      .where(eq(schema.verificationChallenges.id, first.challengeId));
    await api("post", "me/student-verification/email-challenges/confirm")
      .send(first)
      .expect(400);
    const second = await challenge();
    const [old] = await db
      .select()
      .from(schema.emailOutbox)
      .where(
        eq(
          schema.emailOutbox.idempotencyKey,
          `student-verification:${first.challengeId}`,
        ),
      );
    expect(old.status).toBe("cancelled");
    expect(old.payloadCiphertext).toBeNull();
    await api("post", "me/student-verification/email-challenges/confirm")
      .send(first)
      .expect(400);
    await api("post", "me/student-verification/email-challenges/confirm")
      .send(second)
      .expect(200);
  });
  it("enforces the hourly send limit even after cooldown elapses", async () => {
    for (let count = 0; count < 3; count++) {
      const sent = await challenge();
      await db
        .update(schema.verificationChallenges)
        .set({ createdAt: new Date(Date.now() - 61000) })
        .where(eq(schema.verificationChallenges.id, sent.challengeId));
    }
    await api("post", "me/student-verification/email-challenges")
      .send({ email: "owner@student.example.edu" })
      .expect(429);
  });
  it("requires ownership of an email challenge and prevents manual approval of email submissions", async () => {
    const input = await challenge();
    await api(
      "post",
      "me/student-verification/email-challenges/confirm",
      other.token,
    )
      .send(input)
      .expect(400);
    const history = await api("get", "me/student-verification").expect(200);
    await api(
      "post",
      `admin/student-verifications/${history.body[0].id}/decision`,
      reviewer.token,
    )
      .send({ decision: "verified", reason: "Cannot bypass email ownership." })
      .expect(409);
    await api("post", "me/student-verification")
      .send({ method: "university_email" })
      .expect(400);
    await api("post", "me/student-verification")
      .send({ method: "manual_document", evidenceObjectKey: null })
      .expect(400);
  });
  it("requires ready, owned evidence; reviewers cannot open unattached or scanning files", async () => {
    gateway.inspect.mockImplementation(async (publicId: string) => ({
      public_id: publicId,
      asset_id: "asset",
      version: 1,
      bytes: 1234,
      format: "pdf",
      resource_type: "image",
      type: "authenticated",
      moderation: [{ kind: "perception_point", status: "pending" }],
    }));
    const upload = await evidence();
    await api("post", "me/student-verification")
      .send({ method: "manual_document", evidenceObjectKey: upload.objectKey })
      .expect(409);
    await api("get", `uploads/${upload.id}/download`).expect(409);
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
    await api("post", `uploads/${upload.id}/complete`).expect(202);
    await api("get", `uploads/${upload.id}/download`, reviewer.token).expect(
      403,
    );
    await api("post", "me/student-verification", other.token)
      .send({ method: "manual_document", evidenceObjectKey: upload.objectKey })
      .expect(409);
    await api("get", `uploads/${upload.id}`, other.token).expect(404);
  });
  it("supports reviewer queue, private evidence access, one concurrent decision, and student history", async () => {
    const { upload, verification } = await submission();
    await api("get", "admin/student-verifications").expect(403);
    const queue = await api(
      "get",
      "admin/student-verifications",
      reviewer.token,
    ).expect(200);
    expect(queue.body[0].uploadId).toBe(upload.id);
    expect(queue.body[0]).not.toHaveProperty("studentNumberHash");
    await api("get", `uploads/${upload.id}/download`, reviewer.token).expect(
      200,
    );
    await api("get", `uploads/${upload.id}/download`, other.token).expect(403);
    await api("delete", `uploads/${upload.id}`).expect(409);
    const outcomes = await Promise.all([
      api(
        "post",
        `admin/student-verifications/${verification.id}/decision`,
        reviewer.token,
      ).send({ decision: "verified", reason: "Student card checked." }),
      api(
        "post",
        `admin/student-verifications/${verification.id}/decision`,
        reviewer.token,
      ).send({ decision: "rejected", reason: "Concurrent attempt." }),
    ]);
    expect(outcomes.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await db.select().from(schema.verificationDecisions)).toHaveLength(
      1,
    );
    const history = await api("get", "me/student-verification").expect(200);
    expect(history.body[0].reason).toBeTruthy();
    expect(history.body[0]).not.toHaveProperty("evidenceObjectKey");
    const audit = await db
      .select()
      .from(schema.auditEvents)
      .where(eq(schema.auditEvents.action, "verification_evidence.accessed"));
    expect(audit).toHaveLength(1);
  });
  it("forbids self-review and prevents approval after the student changes campus", async () => {
    const own = await submission(reviewer.token);
    await api(
      "post",
      `admin/student-verifications/${own.verification.id}/decision`,
      reviewer.token,
    )
      .send({ decision: "verified", reason: "My own ID." })
      .expect(403);
    const { verification } = await submission();
    const [campus] = await db
      .insert(schema.campuses)
      .values({ universityId, name: "Second", slug: "second" })
      .returning();
    await db
      .update(schema.users)
      .set({ campusId: campus.id })
      .where(eq(schema.users.id, student.id));
    await api(
      "post",
      `admin/student-verifications/${verification.id}/decision`,
      reviewer.token,
    )
      .send({ decision: "verified", reason: "Approval attempt." })
      .expect(409);
    await api(
      "post",
      `admin/student-verifications/${verification.id}/decision`,
      reviewer.token,
    )
      .send({
        decision: "requires_more_information",
        reason: "Resubmit for your new campus.",
      })
      .expect(201);
  });
  it("permits a new evidence submission after rejection and blocks duplicate pending submissions", async () => {
    const { verification } = await submission();
    await api("post", "me/student-verification")
      .send({ method: "manual_document", evidenceObjectKey: "unknown" })
      .expect(409);
    await api("post", "me/student-verification/email-challenges")
      .send({ email: "owner@student.example.edu" })
      .expect(409);
    await api(
      "post",
      `admin/student-verifications/${verification.id}/decision`,
      reviewer.token,
    )
      .send({ decision: "rejected", reason: "The ID is unreadable." })
      .expect(201);
    await submission();
    expect(
      (await api("get", "me/student-verification").expect(200)).body,
    ).toHaveLength(2);
  });
  it("rejects provider metadata mismatch and never treats missing malware moderation as ready", async () => {
    gateway.inspect.mockImplementation(async (publicId: string) => ({
      public_id: publicId,
      asset_id: "asset",
      version: 1,
      bytes: 9999,
      format: "pdf",
      resource_type: "image",
      type: "authenticated",
    }));
    const upload = await evidence();
    expect(
      (await api("get", `uploads/${upload.id}`).expect(200)).body.status,
    ).toBe("rejected");
    gateway.inspect.mockImplementation(async (publicId: string) => ({
      public_id: publicId,
      asset_id: "asset",
      version: 1,
      bytes: 1234,
      format: "pdf",
      resource_type: "image",
      type: "authenticated",
    }));
    const missing = await evidence();
    expect(
      (await api("get", `uploads/${missing.id}`).expect(200)).body.status,
    ).toBe("scanning");
  });
  it("purges expired evidence and denies subsequent downloads or approvals", async () => {
    const { upload, verification } = await submission();
    await db
      .update(schema.uploads)
      .set({ retainUntil: new Date(Date.now() - 1000) })
      .where(eq(schema.uploads.id, upload.id));
    await app.get(UploadsService).purgeExpired();
    expect(gateway.destroy).toHaveBeenCalledWith(upload.objectKey);
    await api("get", `uploads/${upload.id}/download`, reviewer.token).expect(
      409,
    );
    await api(
      "post",
      `admin/student-verifications/${verification.id}/decision`,
      reviewer.token,
    )
      .send({ decision: "verified", reason: "Late approval attempt." })
      .expect(409);
    const [row] = await db
      .select()
      .from(schema.uploads)
      .where(eq(schema.uploads.id, upload.id));
    expect(row.status).toBe("deleted");
  });
  it("revoked reviewer permissions immediately block queue access", async () => {
    await api("get", "admin/student-verifications", reviewer.token).expect(200);
    await db
      .delete(schema.userRoles)
      .where(eq(schema.userRoles.userId, reviewer.id));
    await api("get", "admin/student-verifications", reviewer.token).expect(403);
  });
});
