import { ConfigService } from "@nestjs/config";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { Database } from "../../database/database.module";
import type { StaffTransaction } from "./staff-role-policy";
import { sessions, staffAuthenticators } from "../../database/schema";
import { DomainError } from "../../common/errors/domain.error";
export const STAFF_MFA_LIFETIME_MS=15*60_000;
export async function requireStaffMfa(db:Database|StaffTransaction,config:ConfigService,userId:string,sid?:string) {
 if(config.get('NODE_ENV')!=='production'&&config.get('STAFF_MFA_REQUIRED')==='false')return;
 const [proof]=sid?await db.select({verifiedAt:sessions.staffMfaVerifiedAt,confirmedAt:staffAuthenticators.confirmedAt}).from(sessions).innerJoin(staffAuthenticators,eq(staffAuthenticators.userId,sessions.userId)).where(and(eq(sessions.id,sid),eq(sessions.userId,userId),isNull(sessions.revokedAt),gt(sessions.expiresAt,new Date()))).limit(1):[];
 if(!proof?.confirmedAt||!proof.verifiedAt||proof.verifiedAt.getTime()+STAFF_MFA_LIFETIME_MS<=Date.now())throw new DomainError('STAFF_MFA_REQUIRED','Verify your authenticator before accessing staff tools.',403);
}
