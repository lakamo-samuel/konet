import { ConfigService } from "@nestjs/config";
import { requireStaffMfa } from "./staff-mfa-policy";
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
    if (!setup) await requireStaffMfa(this.db,this.config,userId,context.switchToHttp().getRequest().user?.sid);
    return true;
  }
}
