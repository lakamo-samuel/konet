import { CloudinaryGateway } from "../src/modules/uploads/cloudinary.gateway";
import { ConfigService } from "@nestjs/config";
import { TOTP } from "otpauth";
import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import type { INestApplication } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import request = require("supertest");
import * as schema from "../src/database/schema";
import { DATABASE } from "../src/database/database.module";
import { AuthService } from "../src/modules/auth/auth.service";
import { DomainExceptionFilter } from "../src/common/filters/domain-exception.filter";

process.env.NODE_ENV = "test";
process.env.STAFF_MFA_REQUIRED = "false";
process.env.LOG_LEVEL = "silent";
process.env.JWT_ACCESS_SECRET =
  "directory-access-test-secret-is-long-and-unique";
process.env.JWT_REFRESH_SECRET =
  "directory-refresh-test-secret-is-long-and-unique";
process.env.DATABASE_URL =
  "postgresql://offline:offline@localhost:5432/offline";
process.env.FRONTEND_URL = "http://localhost:3000";
const { AppModule } =
  require("../src/app.module") as typeof import("../src/app.module");
const describeDatabase = process.env.AUTH_TEST_DB_SOCKET
  ? describe
  : describe.skip;
describeDatabase("staff authenticator PostgreSQL API integration", () => {
  const pool = new Pool({
    host: process.env.AUTH_TEST_DB_SOCKET,
    port: 55437,
    database: "konet_staff_security_test",
  });
  const db = drizzle(pool, { schema });
  let app: INestApplication;
  let adminToken: string;
  let studentToken: string;
  let _reviewerToken: string;
  let adminId: string;
  let universityId: string;
  let campusId: string;
  const _input = {
    name: "Second University",
    shortName: "SECOND",
    slug: "second",
    city: "Lagos",
    state: "Lagos",
  };
  beforeAll(async () => {
    const admin = new Pool({
      host: process.env.AUTH_TEST_DB_SOCKET,
      port: 55437,
      database: "postgres",
    });
    try {
      const exists = await admin.query(
        "SELECT 1 FROM pg_database WHERE datname = 'konet_staff_security_test'",
      );
      if (!exists.rowCount)
        await admin.query('CREATE DATABASE "konet_staff_security_test"');
    } finally {
      await admin.end();
    }
    await migrate(db, { migrationsFolder: "src/database/migrations" });
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DATABASE)
      .useValue(db)
      .overrideProvider(ThrottlerGuard)
      .useValue({ canActivate: () => true })
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
    app.get(ConfigService).set("STAFF_MFA_REQUIRED", "true");
    app.get(ConfigService).set("STAFF_MFA_ENCRYPTION_KEY", "a".repeat(64));
    await pool.query('TRUNCATE TABLE "users", "universities" CASCADE');
    const [university] = await db
      .insert(schema.universities)
      .values({
        name: "First University",
        shortName: "FIRST",
        slug: "first",
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
    const auth = app.get(AuthService);
    const registration = {
      fullName: "Test Account",
      universityId,
      campusId,
      password: "directory-test-password",
    };
    const administrator = await auth.register({
      ...registration,
      email: "admin@example.com",
    });
    adminId = administrator.user.id;
    adminToken = administrator.accessToken;
    studentToken = (
      await auth.register({ ...registration, email: "student@example.com" })
    ).accessToken;
    const reviewer = await auth.register({
      ...registration,
      email: "reviewer@example.com",
    });
    _reviewerToken = reviewer.accessToken;
    await db.insert(schema.userRoles).values([
      { userId: adminId, role: "admin" },
      { userId: reviewer.user.id, role: "reviewer" },
    ]);
  });
  afterAll(async () => {
    await app?.close();
    await pool.end();
  });
  function api(method: string, path: string, token = adminToken) {
    const client = request(app.getHttpServer()) as any;
    return client[method](`/api/v1/${path}`).set(
      "Authorization",
      `Bearer ${token}`,
    );
  }

  async function enrollment() {
    return api("post", "me/staff-security/enrollment")
      .send({ password: "directory-test-password" })
      .expect(201);
  }
  it("requires reviewer MFA for another person's private document while preserving owner access", async () => {
    const [student] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "student@example.com"));
    const [verification] = await db
      .insert(schema.studentVerifications)
      .values({
        userId: student.id,
        universityId,
        campusId,
        method: "student_id",
      })
      .returning();
    const [upload] = await db
      .insert(schema.uploads)
      .values({
        userId: student.id,
        objectKey: "private-test-evidence",
        purpose: "student_evidence",
        contentType: "image/png",
        expectedBytes: 100,
        status: "ready",
        verificationId: verification.id,
        expiresAt: new Date(Date.now() + 600000),
        retainUntil: new Date(Date.now() + 86400000),
      })
      .returning();
    const download = jest
      .spyOn(app.get(CloudinaryGateway), "download")
      .mockReturnValue({
        downloadUrl: "https://api.cloudinary.com/test-download",
        expiresAt: new Date(Date.now() + 300000),
      });
    try {
      await api("get", `uploads/${upload.id}/download`).expect(403);
      await api("get", `uploads/${upload.id}/download`, studentToken).expect(
        200,
      );
      const started = await enrollment();
      const code = new TOTP({ secret: started.body.secret }).generate();
      await api("post", "me/staff-security/confirm").send({ code }).expect(201);
      await api("get", `uploads/${upload.id}/download`).expect(200);
      expect(download).toHaveBeenCalledTimes(2);
    } finally {
      download.mockRestore();
    }
  });
  it("requires MFA before staff data, but allows the setup flow only for staff", async () => {
    const denied = await api("get", "admin/users").expect(403);
    expect(denied.body.code).toBe("STAFF_MFA_REQUIRED");
    await api("get", "me/staff-security", studentToken).expect(403);
    const status = await api("get", "me/staff-security").expect(200);
    expect(status.body.enabled).toBe(false);
  });
  it("encrypts secrets, grants only this session, rejects replay and consumes recovery codes once", async () => {
    const started = await enrollment();
    const [stored] = await db
      .select()
      .from(schema.staffAuthenticators)
      .where(eq(schema.staffAuthenticators.userId, adminId));
    expect(stored.pendingCiphertext).not.toContain(started.body.secret);
    const code = new TOTP({ secret: started.body.secret }).generate();
    const confirmed = await api("post", "me/staff-security/confirm")
      .send({ code })
      .expect(201);
    expect(confirmed.body.recoveryCodes).toHaveLength(10);
    await api("get", "admin/users").expect(200);
    await api("post", "me/staff-security/verify").send({ code }).expect(422);
    const recovery = confirmed.body.recoveryCodes[0];
    await api("post", "me/staff-security/verify")
      .send({ code: recovery })
      .expect(201);
    await api("post", "me/staff-security/verify")
      .send({ code: recovery })
      .expect(422);
    const second = await app.get(AuthService).login({
      email: "admin@example.com",
      password: "directory-test-password",
    });
    await api("get", "admin/users", second.accessToken).expect(403);
    await db
      .update(schema.sessions)
      .set({ staffMfaVerifiedAt: new Date(Date.now() - 16 * 60_000) })
      .where(eq(schema.sessions.userId, adminId));
    await api("get", "admin/users").expect(403);
  });
  it("commits failed attempt limits instead of rolling them back", async () => {
    await enrollment();
    for (let i = 0; i < 5; i++)
      await api("post", "me/staff-security/confirm")
        .send({ code: "not-valid" })
        .expect(422);
    await api("post", "me/staff-security/confirm")
      .send({ code: "not-valid" })
      .expect(429);
    await api("post", "me/staff-security/enrollment")
      .send({ password: "directory-test-password" })
      .expect(429);
    const [stored] = await db
      .select()
      .from(schema.staffAuthenticators)
      .where(eq(schema.staffAuthenticators.userId, adminId));
    expect(stored.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
  });
  it("fails closed without an encryption key", async () => {
    app.get(ConfigService).set("STAFF_MFA_ENCRYPTION_KEY", "");
    await api("post", "me/staff-security/enrollment")
      .send({ password: "directory-test-password" })
      .expect(503);
    await api("get", "admin/users").expect(403);
  });
  it("cannot disable MFA enforcement in production", async () => {
    const config = app.get(ConfigService);
    config.set("NODE_ENV", "production");
    config.set("STAFF_MFA_REQUIRED", "false");
    try {
      await api("get", "admin/users").expect(403);
    } finally {
      config.set("NODE_ENV", "test");
    }
  });
});
