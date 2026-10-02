import { ConfigService } from "@nestjs/config";
import { createHmac } from "node:crypto";
import { PaystackGateway } from "../src/infrastructure/payments/paystack.gateway";
import { io, Socket } from "socket.io-client";
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
import { DomainExceptionFilter } from "../src/common/filters/domain-exception.filter";
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.DATABASE_URL =
  "postgresql://offline:offline@localhost:5432/offline";
process.env.JWT_ACCESS_SECRET = "hiring-access-secret-is-long-and-unique";
process.env.JWT_REFRESH_SECRET = "hiring-refresh-secret-is-long-and-unique";
process.env.FRONTEND_URL = "http://localhost:3000";
const { AppModule } =
  require("../src/app.module") as typeof import("../src/app.module");
const describeDatabase = process.env.AUTH_TEST_DB_SOCKET
  ? describe
  : describe.skip;
describeDatabase("hiring PostgreSQL API integration", () => {
  const pool = new Pool({
    host: process.env.AUTH_TEST_DB_SOCKET,
    port: 55437,
    database: "konet_hiring_test",
  });
  const db = drizzle(pool, { schema });
  let app: INestApplication;
  const liveSockets: Socket[] = [];
  afterEach(() => {
    for (const socket of liveSockets.splice(0)) socket.disconnect();
  });
  let client: { id: string; token: string };
  let provider: { id: string; token: string };
  let outsider: { id: string; token: string };
  let providerId: string;
  let serviceId: string;
  let categoryId: string;
  const signingKey = "sk_test_paymenttests";
  const signatureGateway = new PaystackGateway(
    new ConfigService({ PAYSTACK_SECRET_KEY: signingKey }),
  );
  const gateway = {
    assertConfigured: () => {},
    initialize: jest.fn(),
    verify: jest.fn(),
    verifyWebhook: signatureGateway.verifyWebhook.bind(signatureGateway),
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
            "SELECT 1 FROM pg_database WHERE datname='konet_hiring_test'",
          )
        ).rowCount
      )
        await admin.query('CREATE DATABASE "konet_hiring_test"');
    } finally {
      await admin.end();
    }
    await migrate(db, { migrationsFolder: "src/database/migrations" });
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PaystackGateway)
      .useValue(gateway)
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
      .compile();
    app = module.createNestApplication({ logger: false, rawBody: true });
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
    gateway.initialize.mockReset().mockImplementation(async (input) => ({
      reference: input.reference,
      checkoutUrl: "https://checkout.paystack.com/test-checkout",
    }));
    gateway.verify.mockReset();
    await pool.query(
      "DROP TRIGGER IF EXISTS hiring_test_payment_failure ON payments",
    );
    await pool.query("DROP FUNCTION IF EXISTS hiring_test_fail_payment()");
    await pool.query(
      "TRUNCATE TABLE users,universities,service_categories CASCADE",
    );
    const [university] = await db
      .insert(schema.universities)
      .values({
        name: "Hiring University",
        shortName: "HIRE",
        slug: "hire",
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
      const r = await auth.register({
        email,
        password: "hiring-test-password",
        fullName: "Test Account",
        universityId: university.id,
        campusId: campus.id,
      });
      await db
        .update(schema.users)
        .set({ studentVerificationStatus: "verified" })
        .where(eq(schema.users.id, r.user.id));
      return { id: r.user.id, token: r.accessToken };
    };
    client = await account("client@example.com");
    provider = await account("provider@example.com");
    outsider = await account("outsider@example.com");
    const [p] = await db
      .insert(schema.providerProfiles)
      .values({
        userId: provider.id,
        professionalTitle: "Event photographer",
        bio: "Photography and editing for students and campus events.",
        status: "active",
        reviewStatus: "approved",
        approvedAt: new Date(),
      })
      .returning();
    providerId = p.id;
    const [category] = await db
      .insert(schema.serviceCategories)
      .values({ name: "Photography", slug: "photography" })
      .returning();
    categoryId = category.id;
    const [service] = await db
      .insert(schema.services)
      .values({
        providerId,
        categoryId,
        title: "Campus photography",
        description: "Photography for events on campus with edited images.",
        pricingType: "fixed",
        priceMinor: 500000,
        status: "active",
      })
      .returning();
    serviceId = service.id;
  });
  afterAll(async () => {
    await app?.close();
    await pool.end();
  });
  function api(method: string, path: string, token = client.token) {
    const c = request(app.getHttpServer()) as any;
    return c[method](`/api/v1/${path}`).set("Authorization", `Bearer ${token}`);
  }
  const input = () => ({
    providerId,
    serviceId,
    description: "Please photograph our campus event and edit the images.",
    budgetMinMinor: 100000,
    budgetMaxMinor: 600000,
  });
  async function hiringRequest() {
    return (await api("post", "requests").send(input()).expect(201)).body;
  }
  async function quote(requestId: string, amountMinor = 500000) {
    return (
      await api("post", "quotes", provider.token)
        .send({
          requestId,
          amountMinor,
          scope: ["Photograph the event", "Deliver edited photos"],
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
          deliveryAt: new Date(Date.now() + 86400000).toISOString(),
        })
        .expect(201)
    ).body;
  }
  async function counts() {
    return {
      jobs: (await db.select().from(schema.jobs)).length,
      payments: (await db.select().from(schema.payments)).length,
      conversations: (await db.select().from(schema.conversations)).length,
      participants: (await db.select().from(schema.conversationParticipants))
        .length,
    };
  }
  async function initializedPayment() {
    const j = await acceptedJob();
    const checkout = (await api("post", `jobs/${j.id}/payments`).expect(201))
      .body;
    const payment = (await api("get", `jobs/${j.id}/payment`).expect(200)).body;
    const [payer] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, client.id));
    const result = {
      reference: checkout.reference,
      status: "success",
      amountMinor: payment.amountMinor,
      currency: "NGN",
      transactionId: "123456",
      email: payer.email,
      paymentId: payment.id,
    };
    return { j, checkout, payment, result };
  }
  it("initializes server-owned checkout once and verifies funding atomically on concurrent retries", async () => {
    const { j, checkout, payment, result } = await initializedPayment();
    expect(checkout.paymentId).toBe(payment.id);
    const retry = (await api("post", `jobs/${j.id}/payments`).expect(201)).body;
    expect(retry).toEqual(checkout);
    expect(gateway.initialize).toHaveBeenCalledTimes(1);
    await api("post", `jobs/${j.id}/payments`, provider.token).expect(403);
    await api("get", `jobs/${j.id}/payment`, outsider.token).expect(404);
    gateway.verify.mockResolvedValue(result);
    const attempts = await Promise.all([
      api("post", `jobs/${j.id}/payment/verify`),
      api("post", `jobs/${j.id}/payment/verify`, provider.token),
    ]);
    expect(attempts.map((r) => r.status)).toEqual([200, 200]);
    expect(await db.select().from(schema.paymentEvents)).toHaveLength(1);
    expect((await db.select().from(schema.payments))[0].status).toBe("funded");
    expect((await db.select().from(schema.jobs))[0].status).toBe("scheduled");
    expect((await api("get", "me/payments", outsider.token)).body).toHaveLength(
      0,
    );
    await api("get", "me/payments?status=invalid").expect(400);
  });
  it("serializes simultaneous checkout initialization without a second provider call", async () => {
    const j = await acceptedJob();
    let unblock!: () => void;
    let started!: () => void;
    const waiting = new Promise<void>((resolve) => {
      unblock = resolve;
    });
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    gateway.initialize.mockImplementationOnce(async (input) => {
      started();
      await waiting;
      return {
        reference: input.reference,
        checkoutUrl: "https://checkout.paystack.com/test-checkout",
      };
    });
    const first = api("post", `jobs/${j.id}/payments`).then((r: any) => r);
    await entered;
    try {
      await api("post", `jobs/${j.id}/payments`).expect(409);
    } finally {
      unblock();
    }
    expect((await first).status).toBe(201);
    expect(gateway.initialize).toHaveBeenCalledTimes(1);
  });
  it("rolls back funding and event records if scheduling fails", async () => {
    const { j, result } = await initializedPayment();
    gateway.verify.mockResolvedValue(result);
    await pool.query(
      "CREATE FUNCTION hiring_test_fail_funding() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.status='scheduled' THEN RAISE EXCEPTION 'test scheduling failure'; END IF; RETURN NEW; END; $$",
    );
    await pool.query(
      "CREATE TRIGGER hiring_test_funding_failure BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION hiring_test_fail_funding()",
    );
    try {
      await api("post", `jobs/${j.id}/payment/verify`).expect(500);
      expect((await db.select().from(schema.payments))[0].status).toBe(
        "processing",
      );
      expect(await db.select().from(schema.paymentEvents)).toHaveLength(0);
    } finally {
      await pool.query("DROP TRIGGER hiring_test_funding_failure ON jobs");
      await pool.query("DROP FUNCTION hiring_test_fail_funding()");
    }
    await api("post", `jobs/${j.id}/payment/verify`).expect(200);
  });
  it("rejects mismatched verified money, payer and metadata without funding", async () => {
    const { j, result } = await initializedPayment();
    for (const bad of [
      { amountMinor: 1 },
      { currency: "USD" },
      { reference: "wrong-reference" },
      { paymentId: outsider.id },
      { email: "other@example.com" },
    ]) {
      gateway.verify.mockResolvedValue({ ...result, ...bad });
      await api("post", `jobs/${j.id}/payment/verify`).expect(422);
    }
    gateway.verify.mockResolvedValue({ ...result, status: "pending" });
    await api("post", `jobs/${j.id}/payment/verify`).expect(200);
    expect((await db.select().from(schema.jobs))[0].status).toBe(
      "awaiting_payment",
    );
    expect(await db.select().from(schema.paymentEvents)).toHaveLength(0);
  });
  it("validates exact webhook bytes and deduplicates concurrent charge events", async () => {
    const { j, result } = await initializedPayment();
    gateway.verify.mockResolvedValue(result);
    const payload = JSON.stringify({
      event: "charge.success",
      data: { id: 123456, reference: result.reference },
    });
    const signature = createHmac("sha512", signingKey)
      .update(payload)
      .digest("hex");
    const post = (body = payload, sig = signature) =>
      request(app.getHttpServer())
        .post("/api/v1/webhooks/payments/paystack")
        .set("Content-Type", "application/json")
        .set("x-paystack-signature", sig)
        .send(body);
    await post(payload + " ").expect(401);
    await post(payload, "bad-signature").expect(401);
    const attempts = await Promise.all([post(), post()]);
    expect(attempts.map((r) => r.status)).toEqual([200, 200]);
    expect(await db.select().from(schema.paymentEvents)).toHaveLength(1);
    expect((await api("get", `jobs/${j.id}`)).body.status).toBe("scheduled");
    await post().expect(200);
  });
  it("keeps a durable reference after ambiguous checkout failures and prevents unpaid cancellation during checkout", async () => {
    const j = await acceptedJob();
    gateway.initialize.mockRejectedValueOnce(new Error("Simulated timeout"));
    await api("post", `jobs/${j.id}/payments`).expect(500);
    const [attempt] = await db.select().from(schema.paymentCheckouts);
    expect(attempt.checkoutUrl).toBeNull();
    await api("post", `jobs/${j.id}/cancel`)
      .send({ reason: "Cancel during checkout" })
      .expect(409);
    const retry = (await api("post", `jobs/${j.id}/payments`).expect(201)).body;
    expect(retry.reference).toBe(attempt.reference);
    expect(gateway.initialize.mock.calls[0][0].reference).toBe(
      gateway.initialize.mock.calls[1][0].reference,
    );
  });
  async function connectSocket(
    token: string,
    origin?: string,
  ): Promise<Socket> {
    const socket = io(`${await app.getUrl()}/chat`, {
      auth: { token },
      transports: ["websocket"],
      reconnection: false,
      timeout: 2000,
      ...(origin ? { extraHeaders: { Origin: origin } } : {}),
    });
    liveSockets.push(socket);
    return new Promise((resolve, reject) => {
      socket.once("connect", () => resolve(socket));
      socket.once("connect_error", reject);
    });
  }
  function ack(socket: Socket, event: string, body: unknown): Promise<any> {
    return new Promise((resolve, reject) =>
      socket
        .timeout(3000)
        .emit(event, body, (error: Error | null, result: unknown) =>
          error ? reject(error) : resolve(result),
        ),
    );
  }
  function event(socket: Socket, name: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error(`Missing ${name}`)),
        3000,
      );
      socket.once(name, (payload) => {
        clearTimeout(timeout);
        resolve(payload);
      });
    });
  }
  it("delivers committed socket messages, notifications and read receipts to participants", async () => {
    const j = await acceptedJob();
    const c = (await api("get", `jobs/${j.id}/conversation`)).body;
    const sender = await connectSocket(client.token);
    const recipient = await connectSocket(provider.token);
    const unrelated = await connectSocket(outsider.token);
    expect(
      (await ack(sender, "conversation.join", { conversationId: c.id })).ok,
    ).toBe(true);
    expect(
      (await ack(recipient, "conversation.join", { conversationId: c.id })).ok,
    ).toBe(true);
    expect(
      (await ack(unrelated, "conversation.join", { conversationId: c.id }))
        .error.code,
    ).toBe("CONVERSATION_NOT_FOUND");
    let leaked = false;
    unrelated.on("message.new", () => {
      leaked = true;
    });
    const incoming = event(recipient, "message.new");
    const notification = event(recipient, "notification.new");
    const sent = await ack(sender, "message.send", {
      conversationId: c.id,
      content: "Live socket message",
    });
    expect(sent.ok).toBe(true);
    expect((await incoming).id).toBe(sent.data.id);
    expect((await notification).type).toBe("message_received");
    expect(
      (await api("get", `conversations/${c.id}/messages`)).body[0].id,
    ).toBe(sent.data.id);
    const receipt = event(sender, "conversation.read");
    expect(
      (await ack(recipient, "conversation.read", { conversationId: c.id })).ok,
    ).toBe(true);
    expect((await receipt).userId).toBe(provider.id);
    expect(
      (await ack(sender, "message.send", { conversationId: c.id, content: 22 }))
        .error.code,
    ).toBe("INVALID_INPUT");
    expect(
      (
        await ack(sender, "message.send", {
          conversationId: c.id,
          content: "Text",
          senderId: outsider.id,
        })
      ).error.code,
    ).toBe("INVALID_INPUT");
    expect(
      (
        await ack(unrelated, "message.send", {
          conversationId: c.id,
          content: "Forbidden",
        })
      ).ok,
    ).toBe(false);
    expect(leaked).toBe(false);
    const restIncoming = event(recipient, "message.new");
    const restMessage = (
      await api("post", `conversations/${c.id}/messages`)
        .send({ content: "REST also broadcasts" })
        .expect(201)
    ).body;
    expect((await restIncoming).id).toBe(restMessage.id);
  });
  it("rolls back a message and publishes nothing when its notification write fails", async () => {
    const j = await acceptedJob();
    const c = (await api("get", `jobs/${j.id}/conversation`)).body;
    const recipient = await connectSocket(provider.token);
    await ack(recipient, "conversation.join", { conversationId: c.id });
    let delivered = false;
    recipient.on("message.new", () => {
      delivered = true;
    });
    await pool.query(
      "CREATE FUNCTION hiring_test_fail_notification() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test notification failure'; END; $$",
    );
    await pool.query(
      "CREATE TRIGGER hiring_test_notification_failure BEFORE INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION hiring_test_fail_notification()",
    );
    try {
      await api("post", `conversations/${c.id}/messages`)
        .send({ content: "Should roll back" })
        .expect(500);
      expect(await db.select().from(schema.messages)).toHaveLength(0);
      expect(delivered).toBe(false);
    } finally {
      await pool.query(
        "DROP TRIGGER IF EXISTS hiring_test_notification_failure ON notifications",
      );
      await pool.query(
        "DROP FUNCTION IF EXISTS hiring_test_fail_notification()",
      );
    }
  });
  it("rejects invalid socket credentials and origins, and disconnects revoked sessions before delivery", async () => {
    await expect(connectSocket("invalid-token")).rejects.toThrow();
    await expect(
      connectSocket(client.token, "https://untrusted.invalid"),
    ).rejects.toThrow();
    const j = await acceptedJob();
    const c = (await api("get", `jobs/${j.id}/conversation`)).body;
    const recipient = await connectSocket(provider.token);
    await ack(recipient, "conversation.join", { conversationId: c.id });
    let delivered = false;
    recipient.on("message.new", () => {
      delivered = true;
    });
    await db
      .update(schema.sessions)
      .set({ revokedAt: new Date() })
      .where(eq(schema.sessions.userId, provider.id));
    const disconnected = event(recipient, "disconnect");
    await api("post", `conversations/${c.id}/messages`)
      .send({ content: "After revocation" })
      .expect(201);
    await disconnected;
    expect(delivered).toBe(false);
    expect(await db.select().from(schema.messages)).toHaveLength(1);
  });
  async function acceptedJob() {
    const r = await hiringRequest();
    const q = await quote(r.id);
    return (await api("post", `quotes/${q.id}/accept`).expect(201)).body;
  }
  it("keeps conversations private and persists messages, reads and notification preferences", async () => {
    const j = await acceptedJob();
    const c = (await api("get", `jobs/${j.id}/conversation`).expect(200)).body;
    expect(c.participantIds.sort()).toEqual([client.id, provider.id].sort());
    await api("get", `conversations/${c.id}`, outsider.token).expect(404);
    await api("post", `conversations/${c.id}/messages`, outsider.token)
      .send({ content: "Secret" })
      .expect(404);
    await api("post", `conversations/${c.id}/messages`)
      .send({ content: "   " })
      .expect(422);
    await api("post", `conversations/${c.id}/messages`)
      .send({ content: "Hello provider" })
      .expect(201);
    expect(
      (
        await api(
          "get",
          `conversations/${c.id}/messages`,
          provider.token,
        ).expect(200)
      ).body,
    ).toHaveLength(1);
    expect((await api("get", "conversations").expect(200)).body).toHaveLength(
      1,
    );
    await api("patch", `conversations/${c.id}/read`, provider.token).expect(
      200,
    );
    expect(await db.select().from(schema.conversationReads)).toHaveLength(1);
    await api("patch", "notifications/read-all", provider.token).expect(200);
    await api("patch", "me/notification-preferences", provider.token)
      .send({ inAppEnabled: false })
      .expect(200);
    const before = (await db.select().from(schema.notifications)).length;
    await api("post", `conversations/${c.id}/messages`)
      .send({ content: "Muted notification" })
      .expect(201);
    expect((await db.select().from(schema.notifications)).length).toBe(before);
    await api("patch", "me/notification-preferences")
      .send({ inAppEnabled: "false" })
      .expect(400);
    await api("patch", "me/notification-preferences")
      .send({ emailEnabled: null })
      .expect(400);
  });
  it("enforces funded job progression, provider milestones and client confirmation without releasing funds", async () => {
    const j = await acceptedJob();
    await api("post", `jobs/${j.id}/start`, provider.token).expect(409);
    await api("post", `jobs/${j.id}/milestones`)
      .send({ title: "Photo shoot" })
      .expect(403);
    const m = (
      await api("post", `jobs/${j.id}/milestones`, provider.token)
        .send({ title: "Photo shoot" })
        .expect(201)
    ).body;
    await api("patch", `jobs/${j.id}/milestones/${m.id}`, provider.token)
      .send({ status: "completed" })
      .expect(409);
    // Trusted fixture simulates funding; no client endpoint may schedule/fund a job.
    await db
      .update(schema.jobs)
      .set({ status: "scheduled" })
      .where(eq(schema.jobs.id, j.id));
    await db
      .update(schema.payments)
      .set({ status: "held" })
      .where(eq(schema.payments.jobId, j.id));
    await api("post", `jobs/${j.id}/start`).expect(403);
    await api("post", `jobs/${j.id}/start`, provider.token).expect(200);
    await api("post", `jobs/${j.id}/mark-complete`, provider.token).expect(409);
    await api("patch", `jobs/${j.id}/milestones/${m.id}`, provider.token)
      .send({ status: "completed" })
      .expect(200);
    await api("patch", `jobs/${j.id}/milestones/${m.id}`, provider.token)
      .send({ status: "pending" })
      .expect(409);
    await api("post", `jobs/${j.id}/mark-complete`, provider.token).expect(200);
    await api("post", `jobs/${j.id}/confirm-completion`, provider.token).expect(
      403,
    );
    await api("post", `jobs/${j.id}/confirm-completion`).expect(200);
    await api("post", `jobs/${j.id}/confirm-completion`).expect(200);
    expect((await db.select().from(schema.payments))[0].status).toBe("held");
    await api("post", `jobs/${j.id}/milestones`, provider.token)
      .send({ title: "Too late" })
      .expect(409);
    await api("get", `jobs/${j.id}`, outsider.token).expect(404);
  });
  it("cancels only unpaid jobs and records concurrent action once", async () => {
    const j = await acceptedJob();
    await api("post", `jobs/${j.id}/cancel`, outsider.token)
      .send({ reason: "Cancel job" })
      .expect(404);
    const results = await Promise.all([
      api("post", `jobs/${j.id}/cancel`).send({ reason: "Changed plans" }),
      api("post", `jobs/${j.id}/cancel`).send({ reason: "Changed plans" }),
    ]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect(
      await db
        .select()
        .from(schema.auditEvents)
        .where(eq(schema.auditEvents.action, "job.cancelled")),
    ).toHaveLength(1);
  });
  it("blocks funded cancellation and hides other users' notifications", async () => {
    const j = await acceptedJob();
    await db
      .update(schema.payments)
      .set({ status: "held" })
      .where(eq(schema.payments.jobId, j.id));
    await api("post", `jobs/${j.id}/cancel`)
      .send({ reason: "Changed plans" })
      .expect(409);
    const n = (
      await db
        .select()
        .from(schema.notifications)
        .where(eq(schema.notifications.userId, provider.id))
    )[0];
    await api("patch", `notifications/${n.id}/read`).expect(404);
    await api("get", "notifications?status=wrong").expect(400);
    await api("get", "conversations?limit=101").expect(400);
  });
  it("rejects unsupported currencies and oversized quote scopes", async () => {
    await db
      .update(schema.services)
      .set({ currency: "USD" })
      .where(eq(schema.services.id, serviceId));
    await api("post", "requests").send(input()).expect(422);
    await db
      .update(schema.services)
      .set({ currency: "NGN" })
      .where(eq(schema.services.id, serviceId));
    const r = await hiringRequest();
    await api("post", "quotes", provider.token)
      .send({
        requestId: r.id,
        amountMinor: 500000,
        scope: Array(51).fill("Photo"),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      })
      .expect(400);
    const q = await quote(r.id);
    await db
      .update(schema.quotes)
      .set({ currency: "USD" })
      .where(eq(schema.quotes.id, q.id));
    await api("post", `quotes/${q.id}/accept`).expect(422);
    expect((await counts()).jobs).toBe(0);
  });
  it("creates requests and restricts all request/quote reads to their participants", async () => {
    const r = await hiringRequest();
    expect(r.status).toBe("pending");
    await api("get", `requests/${r.id}`, provider.token).expect(200);
    await api("get", `requests/${r.id}`, outsider.token).expect(404);
    expect(
      (await api("get", "requests", outsider.token).expect(200)).body,
    ).toEqual([]);
    const q = await quote(r.id);
    expect((await api("get", `requests/${r.id}`).expect(200)).body.status).toBe(
      "quoted",
    );
    await api("get", `quotes/${q.id}`, outsider.token).expect(404);
    await api("get", `requests/${r.id}/quotes`, outsider.token).expect(404);
    expect(
      (await api("get", "quotes", provider.token).expect(200)).body,
    ).toHaveLength(1);
    await api("post", "quotes")
      .send({
        requestId: r.id,
        amountMinor: 1000,
        scope: ["A scope"],
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      })
      .expect(403);
  });
  it("validates budgets, dates, prices, nulls and self-hiring", async () => {
    await api("post", "requests")
      .send({ ...input(), budgetMinMinor: 700000 })
      .expect(422);
    await api("post", "requests")
      .send({
        ...input(),
        requestedAt: new Date(Date.now() - 1000).toISOString(),
      })
      .expect(422);
    await api("post", "requests")
      .send({ ...input(), budgetMinMinor: null })
      .expect(400);
    await api("post", "requests")
      .send({ ...input(), budgetMaxMinor: 2147483648 })
      .expect(400);
    await api("post", "requests", provider.token).send(input()).expect(422);
    const r = await hiringRequest();
    await api("post", "quotes", provider.token)
      .send({
        requestId: r.id,
        amountMinor: 1000,
        scope: ["   "],
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      })
      .expect(422);
    await api("post", "quotes", provider.token)
      .send({
        requestId: r.id,
        amountMinor: 0,
        scope: ["Valid scope"],
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      })
      .expect(400);
  });
  it("returns one job for sequential and concurrent retries and creates one pending payment and conversation", async () => {
    const r = await hiringRequest();
    const q = await quote(r.id);
    const results = await Promise.all([
      api("post", `quotes/${q.id}/accept`),
      api("post", `quotes/${q.id}/accept`),
    ]);
    expect(results.map((x) => x.status)).toEqual([201, 201]);
    expect(results[0].body.id).toBe(results[1].body.id);
    expect(
      (await api("post", `quotes/${q.id}/accept`).expect(201)).body.id,
    ).toBe(results[0].body.id);
    expect(await counts()).toEqual({
      jobs: 1,
      payments: 1,
      conversations: 1,
      participants: 2,
    });
    const [payment] = await db.select().from(schema.payments);
    expect(payment.status).toBe("pending");
    expect(payment.amountMinor).toBe(q.amountMinor);
    expect((await api("get", `requests/${r.id}`).expect(200)).body.status).toBe(
      "converted_to_job",
    );
    await api("get", `requests/${r.id}/conversation`, provider.token).expect(
      200,
    );
    await api("get", `requests/${r.id}/conversation`, outsider.token).expect(
      404,
    );
    await api("post", `quotes/${q.id}/accept`, provider.token).expect(403);
  });
  it("chooses exactly one of two competing quotes under concurrent acceptance", async () => {
    const r = await hiringRequest();
    const a = await quote(r.id);
    const b = await quote(r.id, 450000);
    const outcomes = await Promise.all([
      api("post", `quotes/${a.id}/accept`),
      api("post", `quotes/${b.id}/accept`),
    ]);
    expect(outcomes.map((x) => x.status).sort()).toEqual([201, 409]);
    expect(await counts()).toEqual({
      jobs: 1,
      payments: 1,
      conversations: 1,
      participants: 2,
    });
    const rows = await db.select().from(schema.quotes);
    expect(rows.filter((q) => q.status === "accepted")).toHaveLength(1);
    expect(rows.filter((q) => q.status === "declined")).toHaveLength(1);
  });
  it("serializes withdrawal versus acceptance and never creates a job for a withdrawn request", async () => {
    const r = await hiringRequest();
    const q = await quote(r.id);
    const outcomes = await Promise.all([
      api("post", `requests/${r.id}/withdraw`).send({
        reason: "Plans changed.",
      }),
      api("post", `quotes/${q.id}/accept`),
    ]);
    expect(outcomes.map((x) => x.status).sort()).toEqual(
      [outcomes[0].status === 200 ? 200 : 201, 409].sort(),
    );
    const current = (await api("get", `requests/${r.id}`).expect(200)).body;
    expect((await counts()).jobs).toBe(current.status === "withdrawn" ? 0 : 1);
  });
  it("withdraws and declines requests only for the correct actor, cancels quotes and supports safe retries", async () => {
    const r = await hiringRequest();
    const q = await quote(r.id);
    await api("post", `requests/${r.id}/withdraw`, provider.token)
      .send({ reason: "Wrong participant." })
      .expect(403);
    await api("post", `requests/${r.id}/decline`)
      .send({ reason: "Wrong participant." })
      .expect(403);
    await api("post", `requests/${r.id}/withdraw`)
      .send({ reason: "No longer needed." })
      .expect(200);
    await api("post", `requests/${r.id}/withdraw`)
      .send({ reason: "Retry." })
      .expect(200);
    expect((await api("get", `quotes/${q.id}`).expect(200)).body.status).toBe(
      "cancelled",
    );
    await api("post", `quotes/${q.id}/accept`).expect(409);
    const another = await hiringRequest();
    await api("post", `requests/${another.id}/decline`, provider.token)
      .send({ reason: "Unable to take this request." })
      .expect(200);
    await api("post", "quotes", provider.token)
      .send({
        requestId: another.id,
        amountMinor: 1000,
        scope: ["A scope"],
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      })
      .expect(409);
  });
  it("allows a new quote after decline/cancellation while forbidding later acceptance of closed quotes", async () => {
    const r = await hiringRequest();
    const a = await quote(r.id);
    await api("post", `quotes/${a.id}/decline`, provider.token)
      .send({ reason: "Wrong actor." })
      .expect(403);
    await api("post", `quotes/${a.id}/decline`)
      .send({ reason: "Too expensive." })
      .expect(200);
    await api("post", `quotes/${a.id}/accept`).expect(409);
    const b = await quote(r.id, 400000);
    await api("post", `quotes/${b.id}/cancel`)
      .send({ reason: "Wrong actor." })
      .expect(403);
    await api("post", `quotes/${b.id}/cancel`, provider.token)
      .send({ reason: "Updated scope required." })
      .expect(200);
    const c = await quote(r.id, 350000);
    await api("post", `quotes/${c.id}/accept`).expect(201);
  });
  it("rejects expired quotes and reports expiry in participant reads and filters", async () => {
    const r = await hiringRequest();
    const q = await quote(r.id);
    await db
      .update(schema.quotes)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(schema.quotes.id, q.id));
    await api("post", `quotes/${q.id}/accept`).expect(409);
    expect((await api("get", `quotes/${q.id}`).expect(200)).body.status).toBe(
      "expired",
    );
    expect(
      (await api("get", "quotes?status=expired").expect(200)).body,
    ).toHaveLength(1);
    expect((await api("get", "quotes?status=sent").expect(200)).body).toEqual(
      [],
    );
    expect((await counts()).jobs).toBe(0);
  });
  it("rechecks provider, student, service and category eligibility on acceptance", async () => {
    const r = await hiringRequest();
    const q = await quote(r.id);
    await db
      .update(schema.providerProfiles)
      .set({ status: "paused" })
      .where(eq(schema.providerProfiles.id, providerId));
    await api("post", `quotes/${q.id}/accept`).expect(404);
    await db
      .update(schema.providerProfiles)
      .set({ status: "active" })
      .where(eq(schema.providerProfiles.id, providerId));
    await db
      .update(schema.serviceCategories)
      .set({ isActive: false })
      .where(eq(schema.serviceCategories.id, categoryId));
    await api("post", `quotes/${q.id}/accept`).expect(404);
    await db
      .update(schema.serviceCategories)
      .set({ isActive: true })
      .where(eq(schema.serviceCategories.id, categoryId));
    await db
      .update(schema.users)
      .set({ studentVerificationStatus: "rejected" })
      .where(eq(schema.users.id, client.id));
    await api("post", `quotes/${q.id}/accept`).expect(403);
    expect((await counts()).jobs).toBe(0);
  });
  it("rolls back the entire conversion when a payment record cannot be created", async () => {
    const r = await hiringRequest();
    const q = await quote(r.id);
    await pool.query(
      "CREATE FUNCTION hiring_test_fail_payment() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'simulated payment persistence failure'; END $$ LANGUAGE plpgsql",
    );
    await pool.query(
      "CREATE TRIGGER hiring_test_payment_failure BEFORE INSERT ON payments FOR EACH ROW EXECUTE FUNCTION hiring_test_fail_payment()",
    );
    await api("post", `quotes/${q.id}/accept`).expect(500);
    expect(await counts()).toEqual({
      jobs: 0,
      payments: 0,
      conversations: 0,
      participants: 0,
    });
    expect((await api("get", `quotes/${q.id}`).expect(200)).body.status).toBe(
      "sent",
    );
    expect((await api("get", `requests/${r.id}`).expect(200)).body.status).toBe(
      "quoted",
    );
    await pool.query("DROP TRIGGER hiring_test_payment_failure ON payments");
    await api("post", `quotes/${q.id}/accept`).expect(201);
  });
  it("retries accepted quotes without requiring the provider to stay published and validates pagination/status", async () => {
    const r = await hiringRequest();
    const q = await quote(r.id);
    const first = await api("post", `quotes/${q.id}/accept`).expect(201);
    await db
      .update(schema.providerProfiles)
      .set({ status: "paused" })
      .where(eq(schema.providerProfiles.id, providerId));
    expect(
      (await api("post", `quotes/${q.id}/accept`).expect(201)).body.id,
    ).toBe(first.body.id);
    expect(
      (await api("get", "requests?status=converted_to_job&limit=1").expect(200))
        .body,
    ).toHaveLength(1);
    await api("get", "requests?status=invalid").expect(400);
    await api("get", "quotes?limit=101").expect(400);
    await api("get", "requests/not-a-uuid").expect(400);
  });
});
