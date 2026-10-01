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
describeDatabase("university directory PostgreSQL API integration", () => {
  const pool = new Pool({
    host: process.env.AUTH_TEST_DB_SOCKET,
    port: 55437,
    database: "konet_directory_test",
  });
  const db = drizzle(pool, { schema });
  let app: INestApplication;
  let adminToken: string;
  let studentToken: string;
  let reviewerToken: string;
  let adminId: string;
  let universityId: string;
  let campusId: string;
  const input = {
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
        "SELECT 1 FROM pg_database WHERE datname = 'konet_directory_test'",
      );
      if (!exists.rowCount)
        await admin.query('CREATE DATABASE "konet_directory_test"');
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
    reviewerToken = reviewer.accessToken;
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

  it("denies anonymous, student, and reviewer directory writes", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/admin/universities")
      .send(input)
      .expect(401);
    await api("post", "admin/universities", studentToken)
      .send(input)
      .expect(403);
    await api("post", "admin/universities", reviewerToken)
      .send(input)
      .expect(403);
    await api("get", "admin/audit-events", studentToken).expect(403);
    expect(await db.select().from(schema.auditEvents)).toHaveLength(0);
  });
  it("checks current database roles rather than token claims", async () => {
    await api("get", "admin/universities").expect(200);
    await db
      .delete(schema.userRoles)
      .where(eq(schema.userRoles.userId, adminId));
    await api("get", "admin/universities").expect(403);
  });
  it("creates and updates universities with an audit actor and normalized slug", async () => {
    const created = await api("post", "admin/universities")
      .send({ ...input, slug: "SECOND" })
      .expect(201);
    expect(created.body.slug).toBe("second");
    await api("patch", `admin/universities/${created.body.id}`)
      .send({ name: "Updated University" })
      .expect(200);
    const audit = await api("get", "admin/audit-events").expect(200);
    expect(audit.body).toHaveLength(2);
    expect(
      audit.body.every((row: { actorId: string }) => row.actorId === adminId),
    ).toBe(true);
    expect(audit.body[0].details.after.name).toBe("Updated University");
  });
  it("rejects duplicates without recording a false success audit", async () => {
    await api("post", "admin/universities").send(input).expect(201);
    await api("post", "admin/universities").send(input).expect(409);
    expect(await db.select().from(schema.auditEvents)).toHaveLength(1);
  });
  it("hides inactive universities and campuses from public reads", async () => {
    await api(
      "patch",
      `admin/universities/${universityId}/campuses/${campusId}`,
    )
      .send({ isActive: false })
      .expect(200);
    const university = await api("get", `universities/${universityId}`).expect(
      200,
    );
    expect(university.body.campuses).toEqual([]);
    const adminCampuses = await api(
      "get",
      `admin/universities/${universityId}/campuses`,
    ).expect(200);
    expect(adminCampuses.body).toHaveLength(1);
    await api("patch", `admin/universities/${universityId}`)
      .send({ isActive: false })
      .expect(200);
    await api("get", `universities/${universityId}`).expect(404);
    await api("get", `universities/${universityId}/campuses`).expect(404);
    const publicList = await api("get", "universities").expect(200);
    expect(publicList.body).toEqual([]);
    const adminList = await api(
      "get",
      "admin/universities?status=inactive",
    ).expect(200);
    expect(adminList.body).toHaveLength(1);
  });
  it("archives a campus without breaking existing account references", async () => {
    await api(
      "delete",
      `admin/universities/${universityId}/campuses/${campusId}`,
    ).expect(204);
    const [campus] = await db
      .select()
      .from(schema.campuses)
      .where(eq(schema.campuses.id, campusId));
    expect(campus.isActive).toBe(false);
    const account = await api("get", "auth/me").expect(200);
    expect(account.body.campusId).toBe(campusId);
    expect(account.body.roles).toEqual(["admin"]);
  });
  it("checks campus and domain ownership against the parent university", async () => {
    const other = await api("post", "admin/universities")
      .send(input)
      .expect(201);
    await api(
      "patch",
      `admin/universities/${other.body.id}/campuses/${campusId}`,
    )
      .send({ name: "Wrong parent" })
      .expect(404);
    const domain = await api(
      "post",
      `admin/universities/${universityId}/email-domains`,
    )
      .send({ domain: "students.first.edu.ng" })
      .expect(201);
    await api(
      "delete",
      `admin/universities/${other.body.id}/email-domains/${domain.body.id}`,
    ).expect(404);
  });
  it("exposes university email verification only when an approved domain exists", async () => {
    const initial = await api(
      "get",
      `universities/${universityId}/verification-methods`,
    ).expect(200);
    expect(initial.body.methods).not.toContain("university_email");
    const domain = await api(
      "post",
      `admin/universities/${universityId}/email-domains`,
    )
      .send({ domain: "STUDENTS.FIRST.EDU.NG" })
      .expect(201);
    expect(domain.body.approved).toBe(false);
    expect(domain.body.domain).toBe("students.first.edu.ng");
    await api(
      "patch",
      `admin/universities/${universityId}/email-domains/${domain.body.id}`,
    )
      .send({ domain: domain.body.domain, approved: true })
      .expect(200);
    const approved = await api(
      "get",
      `universities/${universityId}/verification-methods`,
    ).expect(200);
    expect(approved.body.approvedEmailDomains).toEqual([domain.body.domain]);
    await api(
      "delete",
      `admin/universities/${universityId}/email-domains/${domain.body.id}`,
    ).expect(204);
    const removed = await api(
      "get",
      `universities/${universityId}/verification-methods`,
    ).expect(200);
    expect(removed.body.methods).not.toContain("university_email");
  });
  it("enforces unique domains and rejects URLs, wildcards, null updates, empty updates, and malformed IDs", async () => {
    await api("post", `admin/universities/${universityId}/email-domains`)
      .send({ domain: "students.first.edu.ng" })
      .expect(201);
    await api("post", `admin/universities/${universityId}/email-domains`)
      .send({ domain: "students.first.edu.ng" })
      .expect(409);
    for (const domain of [
      "https://example.com",
      "*.example.com",
      "student@example.com",
      "-bad.example.com",
    ])
      await api("post", `admin/universities/${universityId}/email-domains`)
        .send({ domain })
        .expect(400);
    await api("patch", `admin/universities/${universityId}`)
      .send({ name: null })
      .expect(400);
    await api("patch", `admin/universities/${universityId}`)
      .send({})
      .expect(400);
    await api("patch", "admin/universities/not-a-uuid")
      .send({ name: "Valid name" })
      .expect(400);
    await api("get", "admin/universities?status=pending").expect(400);
  });
  it("lets administrators assign/revoke staff roles with reasons, and blocks self-promotion by students", async () => {
    const accounts = await api(
      "get",
      "admin/users?email=student@example.com",
    ).expect(200);
    expect(accounts.body).toHaveLength(1);
    const targetId = accounts.body[0].id;
    await api("post", `admin/users/${targetId}/roles`, studentToken)
      .send({ role: "admin", reason: "Self promotion" })
      .expect(403);
    const granted = await api("post", `admin/users/${targetId}/roles`)
      .send({ role: "reviewer", reason: "Assigned to verification review" })
      .expect(201);
    expect(granted.body.roles).toEqual(["reviewer"]);
    const roles = await api("get", `admin/users/${targetId}/roles`).expect(200);
    expect(roles.body.roles).toEqual(["reviewer"]);
    await api("post", `admin/users/${targetId}/roles`)
      .send({ role: "reviewer", reason: "Repeated grant" })
      .expect(201);
    expect(await db.select().from(schema.auditEvents)).toHaveLength(1);
    const revoked = await api(
      "delete",
      `admin/users/${targetId}/roles/reviewer`,
    )
      .send({ reason: "Reviewer assignment ended" })
      .expect(200);
    expect(revoked.body.roles).toEqual([]);
    expect(await db.select().from(schema.auditEvents)).toHaveLength(2);
  });
  it("preserves the final active administrator and takes role revocation into account immediately", async () => {
    await api("delete", `admin/users/${adminId}/roles/admin`)
      .send({ reason: "Remove final administrator" })
      .expect(409);
    const accounts = await api(
      "get",
      "admin/users?email=student@example.com",
    ).expect(200);
    const secondId = accounts.body[0].id;
    await api("post", `admin/users/${secondId}/roles`)
      .send({ role: "admin", reason: "Second administrator" })
      .expect(201);
    await api("delete", `admin/users/${adminId}/roles/admin`)
      .send({ reason: "Transfer administration" })
      .expect(200);
    await api("get", "admin/universities").expect(403);
    await api("get", "admin/universities", studentToken).expect(200);
  });
  it("rejects unsupported roles and missing audit reasons", async () => {
    await api("post", `admin/users/${adminId}/roles`)
      .send({ role: "superuser", reason: "Invalid role" })
      .expect(400);
    await api("post", `admin/users/${adminId}/roles`)
      .send({ role: "reviewer" })
      .expect(400);
    await api("get", "admin/users?status=unknown").expect(400);
  });
  it("paginates administrator results with a stable ordering", async () => {
    await api("post", "admin/universities").send(input).expect(201);
    const page = await api("get", "admin/universities?limit=1&offset=1").expect(
      200,
    );
    expect(page.body).toHaveLength(1);
    expect(page.body[0].slug).toBe("second");
    await api("get", "admin/universities?limit=101").expect(400);
  });
});
