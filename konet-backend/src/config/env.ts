import { plainToInstance, Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  MinLength,
  validateSync,
} from "class-validator";

const toBoolean = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
};

class Environment {
  @IsIn(["development", "test", "production"])
  NODE_ENV = "development";

  @Type(() => Number)
  @IsInt()
  @Min(1)
  PORT = 4000;

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @MinLength(32)
  JWT_REFRESH_SECRET!: string;

  @IsString()
  ACCESS_TOKEN_TTL = "15m";

  @Type(() => Number)
  @IsInt()
  @Min(1)
  REFRESH_TOKEN_TTL_DAYS = 30;

  @IsUrl({ require_tld: false })
  FRONTEND_URL!: string;

  @IsString()
  LOG_LEVEL = "info";

  @IsString()
  STORAGE_LOCAL_PATH = "./uploads";

  @IsString()
  SERVICE_NAME = "konet-api";

  @Transform(toBoolean)
  @IsOptional()
  @IsBoolean()
  SWAGGER_ENABLED?: boolean;

  @Transform(toBoolean)
  @IsOptional()
  @IsBoolean()
  TRUST_PROXY?: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  SHUTDOWN_TIMEOUT_MS = 10000;
}

export type EnvironmentConfig = InstanceType<typeof Environment>;

export function validateEnvironment(values: Record<string, unknown>): EnvironmentConfig {
  const parsed = plainToInstance(Environment, values, { enableImplicitConversion: true });
  const errors = validateSync(parsed, { skipMissingProperties: false });
  if (errors.length) {
    throw new Error(
      `Invalid environment configuration: ${errors
        .map((e) => Object.values(e.constraints ?? {}).join(", "))
        .join("; ")}`,
    );
  }
  return parsed;
}

export function resolveSwaggerEnabled(env: EnvironmentConfig): boolean {
  if (env.SWAGGER_ENABLED !== undefined) return env.SWAGGER_ENABLED;
  return env.NODE_ENV !== "production";
}

const KNOWN_KEYS = [
  "NODE_ENV",
  "PORT",
  "DATABASE_URL",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "ACCESS_TOKEN_TTL",
  "REFRESH_TOKEN_TTL_DAYS",
  "FRONTEND_URL",
  "LOG_LEVEL",
  "STORAGE_LOCAL_PATH",
  "SERVICE_NAME",
  "SWAGGER_ENABLED",
  "TRUST_PROXY",
  "SHUTDOWN_TIMEOUT_MS",
] as const;

export function readEnvironment(get: (key: string) => unknown): EnvironmentConfig {
  const source: Record<string, unknown> = {};
  for (const key of KNOWN_KEYS) {
    const value = get(key);
    if (value !== undefined && value !== null && value !== "") source[key] = value;
  }
  return validateEnvironment(source);
}
