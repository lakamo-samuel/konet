import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerDocumentOptions, SwaggerModule } from "@nestjs/swagger";
import { Logger } from "nestjs-pino";
import type { EnvironmentConfig } from "./env";

const SWAGGER_PATH = "api/docs";

export function setupSwagger(app: INestApplication, env: EnvironmentConfig): void {
  const logger = app.get(Logger);
  const config = new DocumentBuilder()
    .setTitle("Konet API")
    .setDescription(
      "Student service discovery, hiring, trust, and protected-payment API. Authenticate with the `Authorization: Bearer <accessToken>` header.",
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
    operationIdFactory: (_controller, method) => method,
  };

  const document = SwaggerModule.createDocument(app, config, options);
  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    jsonDocumentUrl: `${SWAGGER_PATH}/json`,
    yamlDocumentUrl: `${SWAGGER_PATH}/yaml`,
    customSiteTitle: "Konet API docs",
    swaggerOptions: { persistAuthorization: true, displayRequestDuration: true, docExpansion: "list" },
  });

  logger.log(`Swagger UI available at /${SWAGGER_PATH}`);
}
