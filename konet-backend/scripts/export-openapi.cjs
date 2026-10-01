require("reflect-metadata");
const { randomBytes } = require("node:crypto");
const { writeFile } = require("node:fs/promises");
const { resolve } = require("node:path");
const { Test } = require("@nestjs/testing");
const { VersioningType } = require("@nestjs/common");
const { DocumentBuilder, SwaggerModule } = require("@nestjs/swagger");

async function main() {
  // Offline export: ephemeral process-only configuration; no database, listener, or secrets in output.
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL =
    "postgresql://offline:offline@localhost:5432/offline";
  process.env.JWT_ACCESS_SECRET = randomBytes(32).toString("hex");
  process.env.JWT_REFRESH_SECRET = randomBytes(32).toString("hex");
  process.env.FRONTEND_URL = "http://localhost:3000";
  process.env.LOG_LEVEL = "silent";
  const { DATABASE } = require("../dist/database/database.module");
  const { AppModule } = require("../dist/app.module");
  const {
    applyRouteContracts,
  } = require("../dist/modules/contracts/openapi-contracts");
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DATABASE)
    .useValue({})
    .compile();
  const app = module.createNestApplication({ logger: false });
  try {
    app.setGlobalPrefix("api");
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
    await app.init();
    const config = new DocumentBuilder()
      .setTitle("Konet API")
      .setVersion("1.0")
      .setDescription(
        "Frontend integration contract. [contract only] endpoints currently return 501. Payment checkout returns 503 until a gateway is configured. Money is integer NGN kobo; timestamps are ISO 8601; lists are arrays.",
      )
      .addBearerAuth()
      .addServer("http://localhost:4000", "Local")
      .build();
    const document = applyRouteContracts(
      SwaggerModule.createDocument(app, config),
    );
    const destination = resolve(process.cwd(), "openapi.json");
    await writeFile(destination, JSON.stringify(document, null, 2) + "\n");
    console.log(
      `Exported ${Object.values(document.paths).reduce((count, methods) => count + Object.keys(methods).length, 0)} operations to ${destination}`,
    );
  } finally {
    await app.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
