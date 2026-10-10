import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export const DATABASE = Symbol("DATABASE");
export type Database = ReturnType<typeof drizzle<typeof schema>>;

@Global()
@Module({
  providers: [
    {
      provide: DATABASE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        // Prefer DIRECT_URL (non-pooled) over DATABASE_URL (pgbouncer pooler).
        // pgbouncer in transaction mode does not support session-level features
        // such as FOR UPDATE SKIP LOCKED, which the email worker requires.
        const connectionString =
          config.get<string>("DIRECT_URL") ??
          config.getOrThrow<string>("DATABASE_URL");
        const pool = new Pool({
          connectionString,
          max: 10,
          ssl:
            config.get("NODE_ENV") === "production"
              ? { rejectUnauthorized: true }
              : undefined,
        });
        return drizzle(pool, { schema });
      },
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule {}
