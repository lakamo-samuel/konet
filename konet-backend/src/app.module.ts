import { Module, RequestMethod } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { LoggerModule } from "nestjs-pino";
import { buildLoggerParams } from "./config/logger";
import { readEnvironment, validateEnvironment } from "./config/env";
import { DatabaseModule } from "./database/database.module";
import { AuthModule } from "./modules/auth/auth.module";
import { HealthModule } from "./modules/health/health.module";
import { ProvidersModule } from "./modules/providers/providers.module";
import { UniversitiesModule } from "./modules/universities/universities.module";
import { MarketplaceModule } from "./modules/marketplace/marketplace.module";
import { VerificationsModule } from "./modules/verifications/verifications.module";
import { FavoritesModule } from "./modules/favorites/favorites.module";
import { ContractsModule } from "./modules/contracts/contracts.module";
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment, cache: true }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...buildLoggerParams(readEnvironment((key) => config.get(key))),
        forRoutes: [{ path: "{*path}", method: RequestMethod.ALL }],
      }),
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    DatabaseModule,
    AuthModule,
    HealthModule,
    UniversitiesModule,
    ProvidersModule,
    MarketplaceModule,
    VerificationsModule,
    FavoritesModule,
    ContractsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
