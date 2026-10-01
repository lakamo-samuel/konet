import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsOptional,
  ValidateIf,
  IsString,
  IsEmail,
  IsUUID,
  IsUrl,
  IsDateString,
  IsInt,
  IsBoolean,
  IsIn,
  IsArray,
  IsObject,
  Min,
  Max,
  MinLength,
  MaxLength,
  Matches,
  ArrayMinSize,
} from "class-validator";
import { Type } from "class-transformer";

export class RegisterInput {
  @ApiProperty({ type: "string", format: "email" })
  @IsEmail()
  email!: string;
  @ApiProperty({ type: "string", minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;
  @ApiProperty({ type: "string", minLength: 2 })
  @IsString()
  @MinLength(2)
  fullName!: string;
  @ApiProperty({ type: "string", format: "uuid" })
  @IsUUID()
  universityId!: string;
  @ApiProperty({ type: "string", format: "uuid" })
  @IsUUID()
  campusId!: string;
}

export class LoginInput {
  @ApiProperty({ type: "string", format: "email" })
  @IsEmail()
  email!: string;
  @ApiProperty({ type: "string" })
  @IsString()
  password!: string;
}

export class ForgotPasswordInput {
  @ApiProperty({ type: "string", format: "email" })
  @IsEmail()
  email!: string;
}

export class ResetPasswordInput {
  @ApiProperty({ type: "string", minLength: 1 })
  @IsString()
  @MinLength(1)
  token!: string;
  @ApiProperty({ type: "string", minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;
}

export class ProfileInput {
  @ApiPropertyOptional({ type: "string", minLength: 2 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;
  @ApiPropertyOptional({ type: "string", format: "uri" })
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;
  @ApiPropertyOptional({ type: "string", format: "uuid" })
  @IsOptional()
  @IsUUID()
  universityId?: string;
  @ApiPropertyOptional({ type: "string", format: "uuid" })
  @IsOptional()
  @IsUUID()
  campusId?: string;
}

export class EmailChangeInput {
  @ApiProperty({ type: "string", format: "email" })
  @IsEmail()
  email!: string;
  @ApiProperty({ type: "string", minLength: 1 })
  @IsString()
  @MinLength(1)
  password!: string;
}

export class PasswordChangeInput {
  @ApiProperty({ type: "string", minLength: 1 })
  @IsString()
  @MinLength(1)
  currentPassword!: string;
  @ApiProperty({ type: "string", minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}

export class ReasonInput {
  @ApiProperty({ type: "string", minLength: 3 })
  @IsString()
  @MinLength(3)
  reason!: string;
}

export class StudentVerificationInput {
  @ApiProperty({
    type: "string",
    enum: ["university_email", "student_id", "manual_document"],
  })
  @IsString()
  @IsIn(["university_email", "student_id", "manual_document"])
  method!: string;
  @ApiPropertyOptional({ type: "string", minLength: 3 })
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MinLength(3)
  @MaxLength(128)
  studentNumber?: string;
  @ApiPropertyOptional({ type: "string" })
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(512)
  evidenceObjectKey?: string;
}

export class EmailChallengeInput {
  @ApiProperty({ type: "string", format: "email" })
  @IsEmail()
  email!: string;
}

export class ConfirmChallengeInput {
  @ApiProperty({ type: "string", format: "uuid" })
  @IsUUID()
  challengeId!: string;
  @ApiProperty({ type: "string", minLength: 1 })
  @IsString()
  @MinLength(1)
  code!: string;
}

export class ProviderInput {
  @ApiProperty({ type: "string", minLength: 3 })
  @IsString()
  @MinLength(3)
  professionalTitle!: string;
  @ApiProperty({ type: "string", minLength: 40 })
  @IsString()
  @MinLength(40)
  bio!: string;
  @ApiPropertyOptional({ type: "integer", minimum: 1, maximum: 10080 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10080)
  responseTimeMinutes?: number;
  @ApiPropertyOptional({ type: "string", format: "uri" })
  @IsOptional()
  @IsUrl()
  coverImageUrl?: string;
}

export class ProviderUpdateInput {
  @ApiPropertyOptional({ type: "string", minLength: 3 })
  @IsOptional()
  @IsString()
  @MinLength(3)
  professionalTitle?: string;
  @ApiPropertyOptional({ type: "string", minLength: 40 })
  @IsOptional()
  @IsString()
  @MinLength(40)
  bio?: string;
  @ApiPropertyOptional({ type: "integer", minimum: 1, maximum: 10080 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10080)
  responseTimeMinutes?: number;
  @ApiPropertyOptional({ type: "string", format: "uri" })
  @IsOptional()
  @IsUrl()
  coverImageUrl?: string;
  @ApiPropertyOptional({
    type: "string",
    enum: ["available", "unavailable", "limited"],
  })
  @IsOptional()
  @IsString()
  @IsIn(["available", "unavailable", "limited"])
  availability?: string;
}

export class ProviderEvidenceInput {
  @ApiProperty({ type: "string", enum: ["identity", "work", "cac"] })
  @IsString()
  @IsIn(["identity", "work", "cac"])
  dimension!: string;
  @ApiProperty({ type: "string", minLength: 1 })
  @IsString()
  @MinLength(1)
  evidenceObjectKey!: string;
}

export class ProviderStatusInput {
  @ApiProperty({ type: "string", enum: ["active", "paused"] })
  @IsString()
  @IsIn(["active", "paused"])
  status!: string;
}

export class OnboardingStepInput {
  @ApiProperty({ type: "object", additionalProperties: { type: "string" } })
  @IsObject()
  values!: Record<string, unknown>;
}

export class PortfolioInput {
  @ApiProperty({
    type: "string",
    enum: ["image", "external_link", "project", "case_study", "certificate"],
  })
  @IsString()
  @IsIn(["image", "external_link", "project", "case_study", "certificate"])
  type!: string;
  @ApiProperty({ type: "string", minLength: 3 })
  @IsString()
  @MinLength(3)
  title!: string;
  @ApiPropertyOptional({ type: "string" })
  @IsOptional()
  @IsString()
  description?: string;
  @ApiPropertyOptional({ type: "string", format: "uri" })
  @IsOptional()
  @IsUrl()
  assetUrl?: string;
  @ApiPropertyOptional({ type: "string", format: "uri" })
  @IsOptional()
  @IsUrl()
  externalUrl?: string;
}

export class PortfolioUpdateInput {
  @ApiPropertyOptional({
    type: "string",
    enum: ["image", "external_link", "project", "case_study", "certificate"],
  })
  @IsOptional()
  @IsString()
  @IsIn(["image", "external_link", "project", "case_study", "certificate"])
  type?: string;
  @ApiPropertyOptional({ type: "string", minLength: 3 })
  @IsOptional()
  @IsString()
  @MinLength(3)
  title?: string;
  @ApiPropertyOptional({ type: "string" })
  @IsOptional()
  @IsString()
  description?: string;
  @ApiPropertyOptional({ type: "string", format: "uri" })
  @IsOptional()
  @IsUrl()
  assetUrl?: string;
  @ApiPropertyOptional({ type: "string", format: "uri" })
  @IsOptional()
  @IsUrl()
  externalUrl?: string;
}

export class ServiceInput {
  @ApiProperty({ type: "string", format: "uuid" })
  @IsUUID()
  categoryId!: string;
  @ApiProperty({ type: "string", minLength: 3 })
  @IsString()
  @MinLength(3)
  title!: string;
  @ApiProperty({ type: "string", minLength: 30 })
  @IsString()
  @MinLength(30)
  description!: string;
  @ApiProperty({
    type: "string",
    enum: ["fixed", "starting_from", "per_hour", "per_session", "custom_quote"],
  })
  @IsString()
  @IsIn(["fixed", "starting_from", "per_hour", "per_session", "custom_quote"])
  pricingType!: string;
  @ApiPropertyOptional({ type: "integer", minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceMinor?: number;
  @ApiPropertyOptional({
    type: "string",
    minLength: 3,
    maxLength: 3,
    default: "NGN",
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  currency?: string;
}

export class ServiceUpdateInput {
  @ApiPropertyOptional({ type: "string", minLength: 3 })
  @IsOptional()
  @IsString()
  @MinLength(3)
  title?: string;
  @ApiPropertyOptional({ type: "string", minLength: 30 })
  @IsOptional()
  @IsString()
  @MinLength(30)
  description?: string;
  @ApiPropertyOptional({
    type: "string",
    enum: ["fixed", "starting_from", "per_hour", "per_session", "custom_quote"],
  })
  @IsOptional()
  @IsString()
  @IsIn(["fixed", "starting_from", "per_hour", "per_session", "custom_quote"])
  pricingType?: string;
  @ApiPropertyOptional({ type: "integer", minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceMinor?: number;
  @ApiPropertyOptional({
    type: "string",
    enum: ["draft", "active", "paused", "archived"],
  })
  @IsOptional()
  @IsString()
  @IsIn(["draft", "active", "paused", "archived"])
  status?: string;
}

export class RequestInput {
  @ApiProperty({ type: "string", format: "uuid" })
  @IsUUID()
  providerId!: string;
  @ApiProperty({ type: "string", format: "uuid" })
  @IsUUID()
  serviceId!: string;
  @ApiProperty({ type: "string", minLength: 20 })
  @IsString()
  @MinLength(20)
  description!: string;
  @ApiPropertyOptional({ type: "integer", minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  budgetMinMinor?: number;
  @ApiPropertyOptional({ type: "integer", minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  budgetMaxMinor?: number;
  @ApiPropertyOptional({ type: "string", format: "date-time" })
  @IsOptional()
  @IsDateString()
  requestedAt?: string;
  @ApiPropertyOptional({ type: "string" })
  @IsOptional()
  @IsString()
  location?: string;
}

export class QuoteInput {
  @ApiProperty({ type: "string", format: "uuid" })
  @IsUUID()
  requestId!: string;
  @ApiProperty({ type: "integer", minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountMinor!: number;
  @ApiProperty({ type: "array", items: { type: "string" }, minItems: 1 })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  scope!: string[];
  @ApiPropertyOptional({ type: "string", format: "date-time" })
  @IsOptional()
  @IsDateString()
  deliveryAt?: string;
  @ApiPropertyOptional({ type: "string" })
  @IsOptional()
  @IsString()
  notes?: string;
  @ApiProperty({ type: "string", format: "date-time" })
  @IsDateString()
  expiresAt!: string;
}

export class MessageInput {
  @ApiProperty({ type: "string", minLength: 1 })
  @IsString()
  @MinLength(1)
  content!: string;
}

export class ReviewInput {
  @ApiProperty({ type: "string", format: "uuid" })
  @IsUUID()
  jobId!: string;
  @ApiProperty({ type: "integer", minimum: 1, maximum: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;
  @ApiProperty({ type: "string", minLength: 5 })
  @IsString()
  @MinLength(5)
  comment!: string;
}

export class DisputeInput {
  @ApiProperty({ type: "string", minLength: 3 })
  @IsString()
  @MinLength(3)
  reason!: string;
  @ApiProperty({ type: "string", minLength: 20 })
  @IsString()
  @MinLength(20)
  description!: string;
}

export class MilestoneInput {
  @ApiProperty({ type: "string", minLength: 3 })
  @IsString()
  @MinLength(3)
  title!: string;
  @ApiPropertyOptional({ type: "string" })
  @IsOptional()
  @IsString()
  description?: string;
  @ApiPropertyOptional({ type: "string", format: "date-time" })
  @IsOptional()
  @IsDateString()
  dueAt?: string;
}

export class MilestoneUpdateInput {
  @ApiPropertyOptional({ type: "string", minLength: 3 })
  @IsOptional()
  @IsString()
  @MinLength(3)
  title?: string;
  @ApiPropertyOptional({ type: "string" })
  @IsOptional()
  @IsString()
  description?: string;
  @ApiPropertyOptional({ type: "string", format: "date-time" })
  @IsOptional()
  @IsDateString()
  dueAt?: string;
  @ApiPropertyOptional({
    type: "string",
    enum: ["pending", "in_progress", "completed"],
  })
  @IsOptional()
  @IsString()
  @IsIn(["pending", "in_progress", "completed"])
  status?: string;
}

export class UploadInput {
  @ApiProperty({
    type: "string",
    enum: [
      "student_evidence",
      "provider_evidence",
      "portfolio",
      "avatar",
      "message_attachment",
    ],
  })
  @IsString()
  @IsIn([
    "student_evidence",
    "provider_evidence",
    "portfolio",
    "avatar",
    "message_attachment",
  ])
  purpose!: string;
  @ApiProperty({ type: "string", minLength: 1 })
  @IsString()
  @MinLength(1)
  fileName!: string;
  @ApiProperty({
    type: "string",
    enum: ["image/jpeg", "image/png", "application/pdf"],
  })
  @IsString()
  @IsIn(["image/jpeg", "image/png", "application/pdf"])
  contentType!: string;
  @ApiProperty({ type: "integer", minimum: 1, maximum: 10485760 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10485760)
  sizeBytes!: number;
}

export class PayoutAccountInput {
  @ApiProperty({ type: "string", minLength: 1 })
  @IsString()
  @MinLength(1)
  bankCode!: string;
  @ApiProperty({
    type: "string",
    pattern: "^[0-9]{10}$",
    description:
      "Ten-digit bank account number; response exposes only the final four digits.",
  })
  @IsString()
  @Matches(/^[0-9]{10}$/)
  accountNumber!: string;
}

export class RefundInput {
  @ApiProperty({ type: "integer", minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountMinor!: number;
  @ApiProperty({ type: "string", minLength: 3 })
  @IsString()
  @MinLength(3)
  reason!: string;
}

export class DecisionInput {
  @ApiProperty({
    type: "string",
    enum: ["verified", "rejected", "requires_more_information"],
  })
  @IsString()
  @IsIn(["verified", "rejected", "requires_more_information"])
  decision!: string;
  @ApiProperty({ type: "string", minLength: 3 })
  @IsString()
  @MinLength(3)
  reason!: string;
}

export class ProviderDecisionInput {
  @ApiProperty({
    type: "string",
    enum: ["active", "rejected", "requires_more_information"],
  })
  @IsString()
  @IsIn(["active", "rejected", "requires_more_information"])
  decision!: string;
  @ApiProperty({ type: "string", minLength: 3 })
  @IsString()
  @MinLength(3)
  reason!: string;
}

export class DisputeDecisionInput {
  @ApiProperty({
    type: "string",
    enum: ["resolved_for_client", "resolved_for_provider"],
  })
  @IsString()
  @IsIn(["resolved_for_client", "resolved_for_provider"])
  decision!: string;
  @ApiProperty({ type: "string", minLength: 3 })
  @IsString()
  @MinLength(3)
  reason!: string;
  @ApiPropertyOptional({ type: "integer", minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  refundAmountMinor?: number;
}

export class AccountStatusInput {
  @ApiProperty({ type: "string", enum: ["active", "suspended", "deactivated"] })
  @IsString()
  @IsIn(["active", "suspended", "deactivated"])
  status!: string;
  @ApiProperty({ type: "string", minLength: 3 })
  @IsString()
  @MinLength(3)
  reason!: string;
}

export class UniversityInput {
  @ApiProperty({ type: "string", minLength: 2 })
  @IsString()
  @MinLength(2)
  name!: string;
  @ApiProperty({ type: "string", minLength: 2 })
  @IsString()
  @MinLength(2)
  shortName!: string;
  @ApiProperty({ type: "string", minLength: 2 })
  @IsString()
  @MinLength(2)
  slug!: string;
  @ApiProperty({ type: "string" })
  @IsString()
  city!: string;
  @ApiProperty({ type: "string" })
  @IsString()
  state!: string;
  @ApiPropertyOptional({ type: "string", default: "Nigeria" })
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  country?: string;
  @ApiPropertyOptional({ type: "boolean" })
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;
}

export class UniversityUpdateInput {
  @ApiPropertyOptional({ type: "string", minLength: 2 })
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MinLength(2)
  name?: string;
  @ApiPropertyOptional({ type: "string", minLength: 2 })
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MinLength(2)
  shortName?: string;
  @ApiPropertyOptional({ type: "string", minLength: 2 })
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MinLength(2)
  slug?: string;
  @ApiPropertyOptional({ type: "string" })
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  city?: string;
  @ApiPropertyOptional({ type: "string" })
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  state?: string;
  @ApiPropertyOptional({ type: "string", default: "Nigeria" })
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  country?: string;
  @ApiPropertyOptional({ type: "boolean" })
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;
}

export class CampusInput {
  @ApiProperty({ type: "string", minLength: 2 })
  @IsString()
  @MinLength(2)
  name!: string;
  @ApiProperty({ type: "string", minLength: 2 })
  @IsString()
  @MinLength(2)
  slug!: string;
  @ApiPropertyOptional({ type: "boolean" })
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;
}

export class CampusUpdateInput {
  @ApiPropertyOptional({ type: "string", minLength: 2 })
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MinLength(2)
  name?: string;
  @ApiPropertyOptional({ type: "string", minLength: 2 })
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MinLength(2)
  slug?: string;
  @ApiPropertyOptional({ type: "boolean" })
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;
}

export class DomainInput {
  @ApiProperty({ type: "string", minLength: 3 })
  @IsString()
  @MinLength(3)
  domain!: string;
  @ApiPropertyOptional({ type: "boolean" })
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  approved?: boolean;
}

export class CategoryInput {
  @ApiProperty({ type: "string", minLength: 2 })
  @IsString()
  @MinLength(2)
  name!: string;
  @ApiProperty({ type: "string", minLength: 2 })
  @IsString()
  @MinLength(2)
  slug!: string;
  @ApiPropertyOptional({ type: "string", format: "uuid" })
  @IsOptional()
  @IsUUID()
  parentId?: string;
  @ApiPropertyOptional({ type: "boolean" })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CategoryUpdateInput {
  @ApiPropertyOptional({ type: "string", minLength: 2 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;
  @ApiPropertyOptional({ type: "string", minLength: 2 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  slug?: string;
  @ApiPropertyOptional({ type: "string", format: "uuid" })
  @IsOptional()
  @IsUUID()
  parentId?: string;
  @ApiPropertyOptional({ type: "boolean" })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ReconciliationInput {
  @ApiProperty({ type: "string", format: "date-time" })
  @IsDateString()
  from!: string;
  @ApiProperty({ type: "string", format: "date-time" })
  @IsDateString()
  to!: string;
}

export class ContactInput {
  @ApiProperty({ type: "string", format: "email" })
  @IsEmail()
  email!: string;
  @ApiProperty({ type: "string", minLength: 3 })
  @IsString()
  @MinLength(3)
  topic!: string;
  @ApiProperty({ type: "string", minLength: 10 })
  @IsString()
  @MinLength(10)
  message!: string;
}

export class PreferencesInput {
  @ApiPropertyOptional({ type: "boolean" })
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;
  @ApiPropertyOptional({ type: "boolean" })
  @IsOptional()
  @IsBoolean()
  inAppEnabled?: boolean;
}

export class ProviderSearch {
  @ApiPropertyOptional({ type: "string" })
  @IsOptional()
  @IsString()
  query?: string;
  @ApiPropertyOptional({ type: "string", format: "uuid" })
  @IsOptional()
  @IsUUID()
  universityId?: string;
  @ApiPropertyOptional({ type: "string", format: "uuid" })
  @IsOptional()
  @IsUUID()
  campusId?: string;
  @ApiPropertyOptional({ type: "string", format: "uuid" })
  @IsOptional()
  @IsUUID()
  categoryId?: string;
  @ApiPropertyOptional({ type: "integer", minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPriceMinor?: number;
  @ApiPropertyOptional({
    type: "string",
    enum: ["available", "unavailable", "limited"],
  })
  @IsOptional()
  @IsString()
  @IsIn(["available", "unavailable", "limited"])
  availability?: string;
  @ApiPropertyOptional({
    type: "integer",
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
  @ApiPropertyOptional({ type: "integer", minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export class CatalogSearch {
  @ApiPropertyOptional({ type: "string" })
  @IsOptional()
  @IsString()
  query?: string;
  @ApiPropertyOptional({ type: "string", format: "uuid" })
  @IsOptional()
  @IsUUID()
  categoryId?: string;
  @ApiPropertyOptional({ type: "string", format: "uuid" })
  @IsOptional()
  @IsUUID()
  universityId?: string;
}

export class ListQuery {
  @ApiPropertyOptional({
    type: "integer",
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
  @ApiPropertyOptional({ type: "integer", minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
  @ApiPropertyOptional({
    type: "string",
    description: "Optional resource status filter.",
  })
  @IsOptional()
  @IsString()
  status?: string;
}
