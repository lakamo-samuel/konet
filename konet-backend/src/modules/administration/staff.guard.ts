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
import { userRoles, users } from "../../database/schema";
export type StaffRole = "admin" | "reviewer" | "support" | "finance";
const ROLES_KEY = "konet.requiredStaffRoles";
export const RequireRoles = (...roles: StaffRole[]) =>
  SetMetadata(ROLES_KEY, roles);

@Injectable()
export class StaffGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
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
    return true;
  }
}
