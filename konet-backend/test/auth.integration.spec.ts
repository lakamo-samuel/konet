import { AccountService } from "../src/modules/auth/account.service";
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
  const accountService = new AccountService(db, config, email);
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
  async function emailChallenge(userId: string, address = "new@example.com") {
    const challenge = await accountService.requestEmail(userId, {
      email: address,
      password: credentials.password,
    });
    const rows = await db.select().from(schema.emailOutbox);
    const row = rows.find(
      (r) => r.idempotencyKey === `email-change:${challenge.challengeId}`,
    )!;
    const message = email.decrypt(row.payloadCiphertext!);
    return {
      ...challenge,
      code: message.text.match(/code is (\d{6})/)![1],
      row,
    };
  }
  it("edits profiles without exposing password hashes and resets verification on affiliation changes", async () => {
    const r = await register();
    await db
      .update(schema.users)
      .set({ studentVerificationStatus: "verified" })
      .where(eq(schema.users.id, r.user.id));
    const same = await accountService.profile(r.user.id, {
      fullName: "New Student Name",
    });
    expect(same.fullName).toBe("New Student Name");
    expect(same).not.toHaveProperty("passwordHash");
    expect(same.studentVerificationStatus).toBe("verified");
    const [campus] = await db
      .insert(schema.campuses)
      .values({ universityId, name: "Second", slug: "second" })
      .returning();
    await db
      .insert(schema.providerProfiles)
      .values({
        userId: r.user.id,
        professionalTitle: "Student photographer",
        bio: "Photographs and edits campus events for students.",
        status: "active",
        reviewStatus: "approved",
        approvedAt: new Date(),
      });
    const moved = await accountService.profile(r.user.id, {
      campusId: campus.id,
    });
    expect(moved.studentVerificationStatus).toBe("unverified");
    const [p] = await db.select().from(schema.providerProfiles);
    expect(p.status).toBe("draft");
    expect(p.reviewStatus).toBe("not_submitted");
    expect(p.approvedAt).toBeNull();
    await expect(accountService.profile(r.user.id, {})).rejects.toMatchObject({
      code: "EMPTY_PROFILE",
    });
    await expect(
      accountService.profile(r.user.id, {
        universityId: "00000000-0000-4000-8000-000000000099",
      }),
    ).rejects.toMatchObject({ code: "INVALID_CAMPUS" });
  });
  it("requires the current password and configured delivery for email changes", async () => {
    const r = await register();
    await expect(
      accountService.requestEmail(r.user.id, {
        email: "new@example.com",
        password: "wrong",
      }),
    ).rejects.toMatchObject({ code: "INVALID_PASSWORD" });
    await expect(
      accountService.requestEmail(r.user.id, {
        email: credentials.email,
        password: credentials.password,
      }),
    ).rejects.toMatchObject({ code: "EMAIL_UNCHANGED" });
    config.set("RESEND_API_KEY", "");
    try {
      await expect(
        accountService.requestEmail(r.user.id, {
          email: "new@example.com",
          password: credentials.password,
        }),
      ).rejects.toMatchObject({ code: "EMAIL_DELIVERY_NOT_CONFIGURED" });
    } finally {
      config.set("RESEND_API_KEY", "test-only-never-sent");
    }
  });
  it("confirms a private hashed email code, revokes all sessions and queues an old-address alert", async () => {
    const r = await register();
    const c = await emailChallenge(r.user.id);
    const [stored] = await db.select().from(schema.emailChangeChallenges);
    expect(stored.codeHash).not.toBe(c.code);
    expect(c.row.payloadCiphertext).not.toContain(c.code);
    await db
      .update(schema.users)
      .set({ studentVerificationStatus: "verified" })
      .where(eq(schema.users.id, r.user.id));
    const changed = await accountService.confirmEmail(r.user.id, {
      challengeId: c.challengeId,
      code: c.code,
    });
    expect(changed.email).toBe("new@example.com");
    expect(changed.studentVerificationStatus).toBe("verified");
    await expect(authorize(r.accessToken)).rejects.toThrow(
      "Session is revoked",
    );
    await expect(auth.login(credentials)).rejects.toThrow();
    expect(
      (await auth.login({ ...credentials, email: "new@example.com" })).user.id,
    ).toBe(r.user.id);
    await expect(
      accountService.confirmEmail(r.user.id, {
        challengeId: c.challengeId,
        code: c.code,
      }),
    ).rejects.toMatchObject({ code: "INVALID_EMAIL_CHANGE_CODE" });
    const rows = await db.select().from(schema.emailOutbox);
    expect(rows.find((x) => x.id === c.row.id)?.payloadCiphertext).toBeNull();
    const alert = rows.find((x) =>
      x.idempotencyKey.startsWith("email-changed-alert:"),
    )!;
    expect(email.decrypt(alert.payloadCiphertext!).to).toBe(credentials.email);
  });
  it("limits wrong codes to five committed attempts and rejects another users challenge", async () => {
    const r = await register();
    const c = await emailChallenge(r.user.id);
    const other = await auth.register({
      ...credentials,
      email: "other@example.com",
      fullName: "Other Student",
      universityId,
      campusId,
    });
    await expect(
      accountService.confirmEmail(other.user.id, {
        challengeId: c.challengeId,
        code: c.code,
      }),
    ).rejects.toMatchObject({ code: "INVALID_EMAIL_CHANGE_CODE" });
    const wrong = c.code === "000000" ? "000001" : "000000";
    for (let i = 0; i < 5; i++)
      await expect(
        accountService.confirmEmail(r.user.id, {
          challengeId: c.challengeId,
          code: wrong,
        }),
      ).rejects.toMatchObject({ code: "INVALID_EMAIL_CHANGE_CODE" });
    const [row] = await db.select().from(schema.emailChangeChallenges);
    expect(row.attempts).toBe(5);
    expect(row.consumedAt).not.toBeNull();
    await expect(
      accountService.confirmEmail(r.user.id, {
        challengeId: c.challengeId,
        code: c.code,
      }),
    ).rejects.toMatchObject({ code: "INVALID_EMAIL_CHANGE_CODE" });
  });
  it("expires codes and invalidates them after a password change", async () => {
    const r = await register();
    const c = await emailChallenge(r.user.id);
    await auth.changePassword(
      r.user.id,
      credentials.password,
      "new-long-password",
    );
    await expect(
      accountService.confirmEmail(r.user.id, {
        challengeId: c.challengeId,
        code: c.code,
      }),
    ).rejects.toMatchObject({ code: "INVALID_EMAIL_CHANGE_CODE" });
    await db
      .update(schema.emailChangeChallenges)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(schema.emailChangeChallenges.id, c.challengeId));
    await expect(
      accountService.confirmEmail(r.user.id, {
        challengeId: c.challengeId,
        code: c.code,
      }),
    ).rejects.toMatchObject({ code: "INVALID_EMAIL_CHANGE_CODE" });
  });
  it("enforces email cooldown, invalidates older codes on resend and limits requests per hour", async () => {
    const r = await register();
    const first = await emailChallenge(r.user.id);
    await expect(emailChallenge(r.user.id)).rejects.toMatchObject({
      code: "EMAIL_CHANGE_RATE_LIMIT",
    });
    await db
      .update(schema.emailChangeChallenges)
      .set({ createdAt: new Date(Date.now() - 61000) })
      .where(eq(schema.emailChangeChallenges.id, first.challengeId));
    const second = await emailChallenge(r.user.id, "second@example.com");
    await expect(
      accountService.confirmEmail(r.user.id, {
        challengeId: first.challengeId,
        code: first.code,
      }),
    ).rejects.toMatchObject({ code: "INVALID_EMAIL_CHANGE_CODE" });
    await db
      .update(schema.emailChangeChallenges)
      .set({ createdAt: new Date(Date.now() - 61000) })
      .where(eq(schema.emailChangeChallenges.id, second.challengeId));
    await emailChallenge(r.user.id, "third@example.com");
    await expect(
      emailChallenge(r.user.id, "fourth@example.com"),
    ).rejects.toMatchObject({ code: "EMAIL_CHANGE_RATE_LIMIT" });
  });
  it("prevents takeover when the requested email is registered before confirmation", async () => {
    const r = await register();
    const c = await emailChallenge(r.user.id);
    await auth.register({
      ...credentials,
      email: "new@example.com",
      fullName: "Other Student",
      universityId,
      campusId,
    });
    await expect(
      accountService.confirmEmail(r.user.id, {
        challengeId: c.challengeId,
        code: c.code,
      }),
    ).rejects.toMatchObject({ code: "EMAIL_UNAVAILABLE" });
    expect((await auth.login(credentials)).user.email).toBe(credentials.email);
  });
  it("deactivates without deleting history and invalidates sessions and recovery codes", async () => {
    const r = await register();
    await auth.forgotPassword(credentials.email);
    const token = await recoveryToken();
    await accountService.deactivate(r.user.id, "No longer using this account");
    const [u] = await db.select().from(schema.users);
    expect(u.accountStatus).toBe("deactivated");
    await expect(authorize(r.accessToken)).rejects.toThrow(
      "Session is revoked",
    );
    await expect(auth.login(credentials)).rejects.toThrow();
    await expect(
      auth.resetPassword(token, "different-password"),
    ).rejects.toThrow();
    expect(
      (await db.select().from(schema.auditEvents)).find(
        (x) => x.action === "account.deactivated",
      ),
    ).toBeDefined();
  });
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
