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
import { ProfileInput } from "../src/modules/contracts/contract.dto";
import { validateSync } from "class-validator";
import { DATABASE } from "../src/database/database.module";
import { applyRouteContracts } from "../src/modules/contracts/openapi-contracts";
import {
  contractSchemas,
  routeContracts,
} from "../src/modules/contracts/contract-registry";

// Import AppModule only after isolated test configuration is set. No database or network is used.
process.env.NODE_ENV = "test";
process.env.STAFF_MFA_REQUIRED = "false";
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
    token = await app.get(JwtService).signAsync(
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

  it("has no remaining contract-only route", () => {
    expect(routeContracts.filter((route) => !route.existing)).toEqual([]);
  });

  it("allows removing an avatar while keeping non-HTTPS avatar URLs invalid", () => {
    expect(contractSchemas.ProfileInput.properties?.avatarUrl).toMatchObject({
      nullable: true,
    });
    expect(
      validateSync(Object.assign(new ProfileInput(), { avatarUrl: null })),
    ).toEqual([]);
    expect(
      validateSync(
        Object.assign(new ProfileInput(), {
          avatarUrl: "http://example.com/avatar.png",
        }),
      ),
    ).not.toEqual([]);
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
      .post("/api/v1/uploads/avatar")
      .set("Authorization", `Bearer ${token}`)
      .send({ contentType: "image/svg+xml", sizeBytes: 1 })
      .expect(400);
    await request(app.getHttpServer())
      .post("/api/v1/uploads/avatar/complete")
      .set("Authorization", `Bearer ${token}`)
      .send({ publicId: "invalid", extra: true })
      .expect(400);
    await request(app.getHttpServer())
      .post("/api/v1/uploads/avatar/complete")
      .set("Authorization", `Bearer ${token}`)
      .send({
        publicId:
          "konet/avatars/00000000-0000-4000-8000-000000000099/00000000-0000-4000-8000-000000000001",
      })
      .expect(403);
    await request(app.getHttpServer())
      .post("/api/v1/uploads/provider-cover")
      .set("Authorization", `Bearer ${token}`)
      .send({ contentType: "image/svg+xml", sizeBytes: 1 })
      .expect(400);
    await request(app.getHttpServer())
      .post("/api/v1/uploads/provider-cover/complete")
      .set("Authorization", `Bearer ${token}`)
      .send({
        publicId:
          "konet/provider-covers/00000000-0000-4000-8000-000000000099/00000000-0000-4000-8000-000000000001",
      })
      .expect(403);
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
