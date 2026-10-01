import { plainToInstance, Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  Matches,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  Max,
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

  @IsOptional()
  @IsString()
  RESEND_API_KEY?: string;

  @IsOptional()
  @IsEmail()
  EMAIL_FROM?: string;

  @IsOptional()
  @Matches(/^[a-f\d]{64}$/i)
  EMAIL_OUTBOX_KEY?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  PASSWORD_RESET_URL?: string;

  @IsOptional() @Matches(/^[a-zA-Z0-9_-]+$/) CLOUDINARY_CLOUD_NAME?: string;
  @IsOptional() @IsString() CLOUDINARY_API_KEY?: string;
  @IsOptional() @IsString() CLOUDINARY_API_SECRET?: string;
  @Transform(toBoolean)
  @IsOptional()
  @IsBoolean()
  CLOUDINARY_MALWARE_SCAN_ENABLED?: boolean;
  @Type(() => Number) @IsInt() @Min(1) EVIDENCE_RETENTION_DAYS = 30;

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

export function validateEnvironment(
  values: Record<string, unknown>,
): EnvironmentConfig {
  const parsed = plainToInstance(Environment, values, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(parsed, { skipMissingProperties: false });
  if (errors.length) {
    throw new Error(
      `Invalid environment configuration: ${errors
        .map((e) => Object.values(e.constraints ?? {}).join(", "))
        .join("; ")}`,
    );
  }
  if (parsed.JWT_ACCESS_SECRET === parsed.JWT_REFRESH_SECRET)
    throw new Error("JWT access and refresh secrets must be different.");
  const storageConfigured = [
    parsed.CLOUDINARY_CLOUD_NAME,
    parsed.CLOUDINARY_API_KEY,
    parsed.CLOUDINARY_API_SECRET,
  ].filter(Boolean).length;
  if (storageConfigured !== 0 && storageConfigured !== 3)
    throw new Error(
      "Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET together.",
    );
  const emailConfigured = [
    parsed.RESEND_API_KEY,
    parsed.EMAIL_FROM,
    parsed.EMAIL_OUTBOX_KEY,
  ].filter(Boolean).length;
  if (emailConfigured !== 0 && emailConfigured !== 3)
    throw new Error(
      "Set RESEND_API_KEY, EMAIL_FROM, and EMAIL_OUTBOX_KEY together.",
    );
  if (
    parsed.NODE_ENV === "production" &&
    parsed.PASSWORD_RESET_URL &&
    !parsed.PASSWORD_RESET_URL.startsWith("https://")
  )
    throw new Error("Production password reset URL must use HTTPS.");
  if (
    parsed.NODE_ENV === "production" &&
    emailConfigured &&
    !parsed.PASSWORD_RESET_URL &&
    !parsed.FRONTEND_URL.startsWith("https://")
  )
    throw new Error("Production recovery links must use HTTPS.");
  return parsed;
}

export function resolveSwaggerEnabled(env: EnvironmentConfig): boolean {
  if (env.SWAGGER_ENABLED !== undefined) return env.SWAGGER_ENABLED;
  return env.NODE_ENV !== "production";
}

const KNOWN_KEYS = [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "CLOUDINARY_MALWARE_SCAN_ENABLED",
  "EVIDENCE_RETENTION_DAYS",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "EMAIL_OUTBOX_KEY",
  "PASSWORD_RESET_URL",
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

export function readEnvironment(
  get: (key: string) => unknown,
): EnvironmentConfig {
  const source: Record<string, unknown> = {};
  for (const key of KNOWN_KEYS) {
    const value = get(key);
    if (value !== undefined && value !== null && value !== "")
      source[key] = value;
  }
  return validateEnvironment(source);
}
