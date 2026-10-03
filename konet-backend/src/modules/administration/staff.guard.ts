import { ConfigService } from "@nestjs/config";
import { DomainError } from "../../common/errors/domain.error";
import { STAFF_MFA_LIFETIME_MS } from "./staff-security.service";
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { and, eq, inArray } from "drizzle-orm";
import { DATABASE, Database } from "../../database/database.module";
import {
  userRoles,
  users,
  sessions,
  staffAuthenticators,
} from "../../database/schema";
export type StaffRole = "admin" | "reviewer" | "support" | "finance";
const SETUP_KEY = "konet.staffSecuritySetup";
export const StaffSecuritySetup = () => SetMetadata(SETUP_KEY, true);
const ROLES_KEY = "konet.requiredStaffRoles";
export const RequireRoles = (...roles: StaffRole[]) =>
  SetMetadata(ROLES_KEY, roles);

@Injectable()
export class StaffGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private config: ConfigService,
    @Inject(DATABASE) private db: Database,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<StaffRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const userId = context.switchToHttp().getRequest().user?.userId;
    if (!roles?.length || !userId)
      throw new ForbiddenException("Staff permission required");
    const [role] = await this.db
      .select({ role: userRoles.role })
      .from(userRoles)
      .innerJoin(users, eq(userRoles.userId, users.id))
      .where(
        and(
          eq(userRoles.userId, userId),
          inArray(userRoles.role, roles),
          eq(users.accountStatus, "active"),
        ),
      )
      .limit(1);
    if (!role) throw new ForbiddenException("Staff permission required");
    const setup = this.reflector.getAllAndOverride<boolean>(SETUP_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const required =
      this.config.get<string>("NODE_ENV") === "production" ||
      this.config.get<string>("STAFF_MFA_REQUIRED") !== "false";
    if (required && !setup) {
      const sid = context.switchToHttp().getRequest().user?.sid;
      const [proof] = sid
        ? await this.db
            .select({
              verifiedAt: sessions.staffMfaVerifiedAt,
              confirmedAt: staffAuthenticators.confirmedAt,
            })
            .from(sessions)
            .innerJoin(
              staffAuthenticators,
              eq(staffAuthenticators.userId, sessions.userId),
            )
            .where(and(eq(sessions.id, sid), eq(sessions.userId, userId)))
            .limit(1)
        : [];
      if (
        !proof?.confirmedAt ||
        !proof.verifiedAt ||
        proof.verifiedAt.getTime() + STAFF_MFA_LIFETIME_MS <= Date.now()
      )
        throw new DomainError(
          "STAFF_MFA_REQUIRED",
          "Verify your authenticator before accessing staff tools.",
          403,
        );
    }
    return true;
  }
}
