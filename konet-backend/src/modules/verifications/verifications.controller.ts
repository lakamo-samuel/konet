import { Body, Controller, Get, Inject, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, MinLength } from "class-validator";
import { createHash } from "crypto";
import { desc, eq } from "drizzle-orm";
import {
  AuthUser,
  CurrentUser,
} from "../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { DATABASE, Database } from "../../database/database.module";
import { studentVerifications, users } from "../../database/schema";
class SubmitVerificationDto {
  @IsIn(["university_email", "student_id", "manual_document"]) method!: string;
  @IsOptional() @IsString() @MinLength(3) studentNumber?: string;
  @IsOptional() @IsString() evidenceObjectKey?: string;
}
@ApiTags("verification")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ path: "me/student-verification", version: "1" })
export class VerificationsController {
  constructor(@Inject(DATABASE) private db: Database) {}
  @Get() list(@CurrentUser() u: AuthUser) {
    return this.db
      .select({
        id: studentVerifications.id,
        method: studentVerifications.method,
        status: studentVerifications.status,
        submittedAt: studentVerifications.submittedAt,
        decidedAt: studentVerifications.decidedAt,
      })
      .from(studentVerifications)
      .where(eq(studentVerifications.userId, u.userId))
      .orderBy(desc(studentVerifications.createdAt));
  }
  @Post() submit(@CurrentUser() u: AuthUser, @Body() d: SubmitVerificationDto) {
    return this.db.transaction(async (tx) => {
      const [v] = await tx
        .insert(studentVerifications)
        .values({
          userId: u.userId,
          method: d.method,
          studentNumberHash: d.studentNumber
            ? createHash("sha256")
                .update(d.studentNumber.trim().toLowerCase())
                .digest("hex")
            : undefined,
          evidenceObjectKey: d.evidenceObjectKey,
        })
        .returning();
      await tx
        .update(users)
        .set({ studentVerificationStatus: "pending", updatedAt: new Date() })
        .where(eq(users.id, u.userId));
      return v;
    });
  }
}
