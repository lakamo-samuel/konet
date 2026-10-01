import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import request = require("supertest");
import { ThrottlerGuard } from "@nestjs/throttler";
import { DomainExceptionFilter } from "../src/common/filters/domain-exception.filter";
import { DATABASE } from "../src/database/database.module";
import { applyRouteContracts } from "../src/modules/contracts/openapi-contracts";
import {
  contractSchemas,
  routeContracts,
} from "../src/modules/contracts/contract-registry";

// Import AppModule only after isolated test configuration is set. No database or network is used.
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.DATABASE_URL =
  "postgresql://test:test@localhost:5432/konet_contract_test";
process.env.JWT_ACCESS_SECRET =
  "contract-test-access-secret-at-least-32-characters";
process.env.JWT_REFRESH_SECRET =
  "contract-test-refresh-secret-at-least-32-characters";
process.env.FRONTEND_URL = "http://localhost:3000";
const { AppModule } =
  require("../src/app.module") as typeof import("../src/app.module");

describe("v1 frontend API contracts", () => {
  let app: INestApplication;
  let token: string;
  const database = {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: () => ({ limit: async () => [{ accountStatus: "active" }] }),
        }),
      }),
    }),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DATABASE)
      .useValue(database)
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
    token = await app
      .get(JwtService)
      .signAsync(
        {
          userId: "00000000-0000-4000-8000-000000000001",
          sid: "00000000-0000-4000-8000-000000000002",
          type: "access",
        },
        { secret: app.get(ConfigService).getOrThrow("JWT_ACCESS_SECRET") },
      );
  });
  afterAll(async () => {
    await app?.close();
  });

  it("documents every registered route exactly once, with unique operation IDs and defined schema references", () => {
    const document = applyRouteContracts(
      SwaggerModule.createDocument(
        app,
        new DocumentBuilder().addBearerAuth().build(),
      ),
    );
    const operations = Object.values(document.paths).flatMap((path) =>
      Object.entries(path)
        .filter(([method]) =>
          ["get", "post", "patch", "delete", "put"].includes(method),
        )
        .map(([, operation]) => operation),
    );
    expect(operations).toHaveLength(routeContracts.length);
    expect(
      new Set(operations.map((operation) => operation.operationId)).size,
    ).toBe(operations.length);
    for (const route of routeContracts) {
      const operation =
        document.paths[`/api/v1/${route.path}`][route.method as "get"]!;
      expect(operation.responses?.[route.code]).toBeDefined();
      if (!route.existing) expect(operation.responses?.[501]).toBeDefined();
      if (route.body)
        expect(contractSchemas[route.body].properties).not.toEqual({});
    }
    const refs = JSON.stringify(document).matchAll(
      /"\$ref":"#\/components\/schemas\/([^"]+)"/g,
    );
    for (const [, name] of refs)
      expect(document.components?.schemas?.[name]).toBeDefined();
  });

  it("rejects missing authentication on member and admin routes", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/me/provider-profile")
      .expect(401);
    await request(app.getHttpServer()).get("/api/v1/admin/users").expect(401);
  });

  it("fails closed for every valid contract-only route without calling database operations", async () => {
    function sample(schema: Record<string, any>): any {
      if (schema.enum) return schema.enum[0];
      if (schema.type === "object")
        return Object.fromEntries(
          (schema.required ?? []).map((key: string) => [
            key,
            sample(schema.properties[key]),
          ]),
        );
      if (schema.type === "array") return [sample(schema.items)];
      if (schema.type === "integer") return Math.max(schema.minimum ?? 1, 1);
      if (schema.type === "boolean") return true;
      if (schema.format === "uuid")
        return "00000000-0000-4000-8000-000000000001";
      if (schema.format === "email") return "student@example.com";
      if (schema.format === "uri") return "https://example.com/image.png";
      if (schema.format === "date-time") return "2026-10-01T12:00:00.000Z";
      if (schema.pattern) return "0123456789";
      return "a".repeat(Math.max(schema.minLength ?? 1, 10));
    }
    for (const route of routeContracts.filter((route) => !route.existing)) {
      const path = `/api/v1/${route.path}`.replace(/\{(\w+)\}/g, (_, name) =>
        name === "step"
          ? "profile"
          : name === "gateway"
            ? "candidate"
            : "00000000-0000-4000-8000-000000000001",
      );
      const client = request(app.getHttpServer()) as any;
      const req = client[route.method](path).set(
        "Authorization",
        `Bearer ${token}`,
      );
      if (route.body) req.send(sample(contractSchemas[route.body]));
      const response = await req;
      expect({
        route: `${route.method} ${path}`,
        status: response.status,
        body: response.body,
      }).toEqual({
        route: `${route.method} ${path}`,
        status: 501,
        body: {
          statusCode: 501,
          code: "ENDPOINT_NOT_IMPLEMENTED",
          message: `${route.summary} is contract-only; backend implementation is pending.`,
          path,
        },
      });
    }
  });

  it("validates required fields, UUIDs, file size, and unknown request fields", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/auth/reset-password")
      .send({ password: "short" })
      .expect(400);
    await request(app.getHttpServer())
      .get("/api/v1/requests/not-a-uuid")
      .set("Authorization", `Bearer ${token}`)
      .expect(400);
    await request(app.getHttpServer())
      .post("/api/v1/uploads/presign")
      .set("Authorization", `Bearer ${token}`)
      .send({
        purpose: "student_evidence",
        fileName: "id.pdf",
        contentType: "application/pdf",
        sizeBytes: 10485761,
      })
      .expect(400);
    await request(app.getHttpServer())
      .post("/api/v1/contact")
      .send({
        email: "a@example.com",
        topic: "Help",
        message: "Please help with my account",
        admin: true,
      })
      .expect(400);
  });
});
