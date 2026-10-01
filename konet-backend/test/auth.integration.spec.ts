import "reflect-metadata";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { ExecutionContext } from "@nestjs/common";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import * as argon2 from "argon2";
import * as schema from "../src/database/schema";
import { AuthService } from "../src/modules/auth/auth.service";
import { AuthGuard } from "../src/common/guards/auth.guard";
import {
  EmailDeliveryError,
  EmailService,
} from "../src/infrastructure/email/email.service";

// Explicit opt-in to an isolated database; never use the application's DATABASE_URL.
const describeDatabase = process.env.AUTH_TEST_DB_SOCKET
  ? describe
  : describe.skip;
describeDatabase("account and recovery PostgreSQL integration", () => {
  const pool = new Pool({
    host: process.env.AUTH_TEST_DB_SOCKET,
    port: 55437,
    database: "konet_auth_test",
    max: 8,
  });
  const db = drizzle(pool, { schema });
  const config = new ConfigService({
    NODE_ENV: "test",
    JWT_ACCESS_SECRET: "access-test-secret-is-long-and-unique",
    JWT_REFRESH_SECRET: "refresh-test-secret-is-long-and-unique",
    REFRESH_TOKEN_TTL_DAYS: 30,
    ACCESS_TOKEN_TTL: "15m",
    FRONTEND_URL: "https://konet.example",
    PASSWORD_RESET_URL: "https://konet.example/reset-password",
    RESEND_API_KEY: "test-only-never-sent",
    EMAIL_FROM: "support@konet.example",
    EMAIL_OUTBOX_KEY: "12".repeat(32),
  });
  const jwt = new JwtService();
  const email = new EmailService(db, config);
  const auth = new AuthService(db, jwt, config, email);
  const guard = new AuthGuard(jwt, config, db);
  let universityId: string;
  let campusId: string;
  const credentials = {
    email: "student@example.com",
    password: "original-long-password",
  };
  async function register() {
    return auth.register({
      ...credentials,
      fullName: "Test Student",
      universityId,
      campusId,
    });
  }
  async function authorize(accessToken: string) {
    const req = { headers: { authorization: `Bearer ${accessToken}` } };
    const context = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
    return guard.canActivate(context);
  }
  async function recoveryToken() {
    const [row] = await db.select().from(schema.emailOutbox);
    const payload = email.decrypt(row.payloadCiphertext!);
    return new URLSearchParams(
      new URL(payload.text.match(/https:\/\/\S+/)![0]).hash.slice(1),
    ).get("token")!;
  }
  beforeAll(async () => {
    const admin = new Pool({
      host: process.env.AUTH_TEST_DB_SOCKET,
      port: 55437,
      database: "postgres",
    });
    try {
      const exists = await admin.query(
        "SELECT 1 FROM pg_database WHERE datname = 'konet_auth_test'",
      );
      if (!exists.rowCount)
        await admin.query('CREATE DATABASE "konet_auth_test"');
    } finally {
      await admin.end();
    }
    await migrate(db, { migrationsFolder: "src/database/migrations" });
  });
  beforeEach(async () => {
    // This suite's disposable database only.
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
  });
  afterAll(async () => {
    await pool.end();
  });

  it("normalizes registration, hides password hashes, rejects duplicate emails and inactive universities", async () => {
    const session = await auth.register({
      ...credentials,
      email: "Student@Example.com",
      fullName: "Test Student",
      universityId,
      campusId,
    });
    expect(session.user.email).toBe("student@example.com");
    expect(session.user).not.toHaveProperty("passwordHash");
    await expect(register()).rejects.toMatchObject({ code: "EMAIL_IN_USE" });
    await db
      .update(schema.universities)
      .set({ isActive: false })
      .where(eq(schema.universities.id, universityId));
    await expect(
      auth.register({
        ...credentials,
        email: "other@example.com",
        fullName: "Other Student",
        universityId,
        campusId,
      }),
    ).rejects.toMatchObject({ code: "INVALID_CAMPUS" });
  });
  it("revokes access immediately after logout", async () => {
    const session = await register();
    await expect(authorize(session.accessToken)).resolves.toBe(true);
    await auth.logout(session.refreshToken);
    await expect(authorize(session.accessToken)).rejects.toThrow(
      "Session is revoked",
    );
  });
  it("rotates refresh once and revokes the replacement on replay", async () => {
    const original = await register();
    const rotated = await auth.refresh(original.refreshToken);
    await expect(authorize(original.accessToken)).rejects.toThrow();
    await expect(authorize(rotated.accessToken)).resolves.toBe(true);
    await expect(auth.refresh(original.refreshToken)).rejects.toMatchObject({
      code: "REFRESH_TOKEN_REUSED",
    });
    await expect(authorize(rotated.accessToken)).rejects.toThrow();
  });
  it("rejects concurrent refresh reuse and leaves no live replacement", async () => {
    const session = await register();
    const results = await Promise.allSettled([
      auth.refresh(session.refreshToken),
      auth.refresh(session.refreshToken),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const sessions = await db.select().from(schema.sessions);
    expect(sessions.every((session) => session.revokedAt !== null)).toBe(true);
  });
  it("blocks access and refresh for suspended accounts", async () => {
    const session = await register();
    await db
      .update(schema.users)
      .set({ accountStatus: "suspended" })
      .where(eq(schema.users.id, session.user.id));
    await expect(authorize(session.accessToken)).rejects.toThrow();
    await expect(auth.refresh(session.refreshToken)).rejects.toMatchObject({
      code: "ACCOUNT_UNAVAILABLE",
    });
  });
  it("queues encrypted recovery once and returns the same acknowledgement for unknown and throttled accounts", async () => {
    await register();
    const known = await auth.forgotPassword(credentials.email);
    expect(await auth.forgotPassword("unknown@example.com")).toEqual(known);
    expect(await auth.forgotPassword(credentials.email)).toEqual(known);
    const queued = await db.select().from(schema.emailOutbox);
    expect(queued).toHaveLength(1);
    expect(queued[0].payloadCiphertext).not.toContain("student@example.com");
    const token = await recoveryToken();
    const [reset] = await db.select().from(schema.passwordResetTokens);
    expect(reset.tokenHash).not.toBe(token);
    expect(
      reset.expiresAt.getTime() - reset.createdAt.getTime(),
    ).toBeLessThanOrEqual(30 * 60000);
  });
  it("resets password once, revokes every session and rejects the old password", async () => {
    const first = await register();
    const second = await auth.login(credentials);
    await auth.forgotPassword(credentials.email);
    const token = await recoveryToken();
    await auth.resetPassword(token, "replacement-long-password");
    await expect(
      auth.resetPassword(token, "another-long-password"),
    ).rejects.toMatchObject({ code: "INVALID_RESET_TOKEN" });
    await expect(authorize(first.accessToken)).rejects.toThrow();
    await expect(authorize(second.accessToken)).rejects.toThrow();
    await expect(auth.login(credentials)).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
    await expect(
      auth.login({
        email: credentials.email,
        password: "replacement-long-password",
      }),
    ).resolves.toHaveProperty("accessToken");
  });
  it("allows exactly one concurrent reset and rejects expired links", async () => {
    await register();
    await auth.forgotPassword(credentials.email);
    const token = await recoveryToken();
    const results = await Promise.allSettled([
      auth.resetPassword(token, "new-long-password-one"),
      auth.resetPassword(token, "new-long-password-two"),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    await db
      .update(schema.passwordResetTokens)
      .set({ consumedAt: null, expiresAt: new Date(Date.now() - 1) });
    await expect(
      auth.resetPassword(token, "another-long-password"),
    ).rejects.toMatchObject({ code: "INVALID_RESET_TOKEN" });
  });
  it("requires current password and revokes all sessions on password change", async () => {
    const session = await register();
    await expect(
      auth.changePassword(
        session.user.id,
        "wrong-password",
        "new-long-password",
      ),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    await expect(authorize(session.accessToken)).resolves.toBe(true);
    await auth.changePassword(
      session.user.id,
      credentials.password,
      "new-long-password",
    );
    await expect(authorize(session.accessToken)).rejects.toThrow();
    const [user] = await db.select().from(schema.users);
    expect(await argon2.verify(user.passwordHash, "new-long-password")).toBe(
      true,
    );
  });
  it("retries provider failures with the same idempotency key and clears secret payload after sending", async () => {
    await register();
    await auth.forgotPassword(credentials.email);
    const deliver = jest
      .spyOn(email, "deliver")
      .mockRejectedValueOnce(new EmailDeliveryError("EMAIL_PROVIDER_429", true))
      .mockResolvedValue("message-id");
    try {
      await email.processNext();
      const [pending] = await db.select().from(schema.emailOutbox);
      expect(pending.status).toBe("pending");
      expect(pending.attempts).toBe(1);
      await db.update(schema.emailOutbox).set({ nextAttemptAt: new Date() });
      await email.processNext();
      const [sent] = await db.select().from(schema.emailOutbox);
      expect(sent.status).toBe("sent");
      expect(sent.payloadCiphertext).toBeNull();
      expect(deliver.mock.calls[0][1]).toBe(deliver.mock.calls[1][1]);
    } finally {
      deliver.mockRestore();
    }
  });
  it("never sends expired recovery emails", async () => {
    await register();
    await auth.forgotPassword(credentials.email);
    await db
      .update(schema.emailOutbox)
      .set({ expiresAt: new Date(Date.now() - 1) });
    const deliver = jest.spyOn(email, "deliver");
    try {
      await email.processNext();
      expect(deliver).not.toHaveBeenCalled();
    } finally {
      deliver.mockRestore();
    }
  });
});
