import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Params } from "nestjs-pino";
import type { EnvironmentConfig } from "./env";

const IGNORED_PATHS = ["/api/v1/health", "/api/docs"];

const shouldIgnore = (req: IncomingMessage) => {
  const url = req.url ?? "";
  return IGNORED_PATHS.some(
    (path) => url === path || url.startsWith(`${path}/`),
  );
};

export function buildLoggerParams(env: EnvironmentConfig): Params {
  const usePretty = env.NODE_ENV === "development";
  return {
    pinoHttp: {
      name: env.SERVICE_NAME,
      level: env.LOG_LEVEL,
      base: { service: env.SERVICE_NAME, env: env.NODE_ENV },
      genReqId: (req) =>
        (req.headers["x-request-id"] as string) || randomUUID(),
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          'req.headers["x-api-key"]',
          'res.headers["set-cookie"]',
          "req.body.password",
          "req.body.currentPassword",
          "req.body.newPassword",
          "req.body.refreshToken",
          "req.body.token",
          "req.body.code",
          "req.body.studentNumber",
          "req.body.evidenceObjectKey",
        ],
        censor: "[REDACTED]",
      },
      autoLogging: { ignore: shouldIgnore },
      customLogLevel: (_req, res: ServerResponse, err) => {
        if (err || res.statusCode >= 500) return "error";
        if (res.statusCode >= 400) return "warn";
        return "info";
      },
      customSuccessMessage: (req, res) =>
        `${req.method} ${req.url} ${res.statusCode}`,
      customErrorMessage: (req, res, err) =>
        `${req.method} ${req.url} ${res.statusCode} - ${err.message}`,
      serializers: {
        req: (
          req: IncomingMessage & {
            method: string;
            url: string;
            remoteAddress?: string;
          },
        ) => ({
          id: req.id,
          method: req.method,
          url: req.url,
          remoteAddress: req.remoteAddress,
        }),
        res: (res: ServerResponse & { statusCode: number }) => ({
          statusCode: res.statusCode,
        }),
      },
      transport: usePretty
        ? {
            target: "pino-pretty",
            options: {
              colorize: true,
              singleLine: true,
              translateTime: "SYS:standard",
              ignore: "pid,hostname,service,env",
            },
          }
        : undefined,
    },
  };
}
