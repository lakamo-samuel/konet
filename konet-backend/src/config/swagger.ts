import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerDocumentOptions, SwaggerModule } from "@nestjs/swagger";
import { Logger } from "nestjs-pino";
import type { EnvironmentConfig } from "./env";
import { applyRouteContracts } from "../modules/contracts/openapi-contracts";

const SWAGGER_PATH = "api/docs";

export function setupSwagger(app: INestApplication, env: EnvironmentConfig): void {
  const logger = app.get(Logger);
  const config = new DocumentBuilder()
    .setTitle("Konet API")
    .setDescription(
      "Konet v1 integration contract. Authenticate with Authorization: Bearer <accessToken>. Routes marked [contract only] return 501 until implemented; their success schemas are targets for frontend mocks. Payment checkout currently returns 503. All money is integer NGN kobo; timestamps are ISO 8601. Lists are arrays. Admin and payment provider contracts are provisional until roles/provider selection are finalized.",
    )
    .setVersion("1.0")
    .addBearerAuth(
      { type: "http", scheme: "bearer", bearerFormat: "JWT", in: "header", name: "Authorization" },
      "bearer",
    )
    .addServer(`http://localhost:${env.PORT}`, "Local")
    .addTag("auth", "Registration, login, refresh, password reset")
    .addTag("health", "Liveness and database reachability")
    .addTag("universities", "Universities and campuses")
    .addTag("providers", "Provider directory and profiles")
    .addTag("catalog", "Categories and services")
    .addTag("marketplace", "Listings, requests, quotes, jobs")
    .addTag("payments", "Protected job payments")
    .addTag("reviews", "Post-job reviews")
    .addTag("notifications", "In-app notifications")
    .addTag("verifications", "Student verification")
    .addTag("favorites", "Favorited providers")
    .build();

  const options: SwaggerDocumentOptions = {
    operationIdFactory: (controller, method) => `${controller}_${method}`,
  };

  const document = applyRouteContracts(SwaggerModule.createDocument(app, config, options));
  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    jsonDocumentUrl: `${SWAGGER_PATH}/json`,
    yamlDocumentUrl: `${SWAGGER_PATH}/yaml`,
    customSiteTitle: "Konet API docs",
    swaggerOptions: { persistAuthorization: true, displayRequestDuration: true, docExpansion: "list" },
  });

  logger.log(`Swagger UI available at /${SWAGGER_PATH}`);
}
