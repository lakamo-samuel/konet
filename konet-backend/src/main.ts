import "reflect-metadata";
import {
  ValidationPipe,
  VersioningType,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import type { NestExpressApplication } from "@nestjs/platform-express";
import helmet from "helmet";
import cookieParser = require("cookie-parser");
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { DomainExceptionFilter } from "./common/filters/domain-exception.filter";
import type { EnvironmentConfig } from "./config/env";
import { readEnvironment, resolveSwaggerEnabled } from "./config/env";
import { setupSwagger } from "./config/swagger";

function applySecurityMiddleware(app: NestExpressApplication, env: EnvironmentConfig): void {
  app.use(
    helmet({
      contentSecurityPolicy: env.NODE_ENV === "production" ? undefined : false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(cookieParser());
  app.disable("x-powered-by");
  if (env.TRUST_PROXY) app.set("trust proxy", 1);
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    abortOnError: false,
  });

  const config = app.get(ConfigService);
  const env = readEnvironment((key) => config.get(key));
  const logger = app.get(Logger);

  app.useLogger(logger);
  applySecurityMiddleware(app, env);

  app.enableCors({
    origin: env.FRONTEND_URL.split(",").map((origin) => origin.trim()),
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
    exposedHeaders: ["X-Request-Id"],
    maxAge: 86400,
  });

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
  app.setGlobalPrefix("api");

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new DomainExceptionFilter());

  app.enableShutdownHooks();

  if (resolveSwaggerEnabled(env)) setupSwagger(app, env);

  installProcessGuards(app, logger, env.SHUTDOWN_TIMEOUT_MS);

  await app.listen(env.PORT, "0.0.0.0");

  logger.log(
    `${env.SERVICE_NAME} started in ${env.NODE_ENV} mode on port ${env.PORT}` +
      (resolveSwaggerEnabled(env) ? " (docs at /api/docs)" : ""),
  );
}

function installProcessGuards(
  app: NestExpressApplication,
  logger: Logger,
  timeoutMs: number,
): void {
  const shutdown = async (signal: string) => {
    logger.log({ signal }, "Shutting down");
    const force = setTimeout(() => {
      logger.error("Graceful shutdown timed out, forcing exit");
      process.exit(1);
    }, timeoutMs);
    force.unref();
    try {
      await app.close();
      clearTimeout(force);
      process.exit(0);
    } catch (error) {
      logger.error({ err: error }, "Shutdown failed");
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("uncaughtException", (error) => {
    logger.fatal({ err: error }, "Uncaught exception");
    void shutdown("uncaughtException");
  });
  process.on("unhandledRejection", (reason) => {
    logger.fatal({ err: reason }, "Unhandled rejection");
    void shutdown("unhandledRejection");
  });
}

void bootstrap().catch((error) => {
  console.error("Fatal bootstrap error", error);
  process.exit(1);
});
