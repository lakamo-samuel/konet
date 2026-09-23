import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  MinLength,
} from "class-validator";
export class CreateServiceDto {
  @IsUUID() categoryId!: string;
  @IsString() @MinLength(3) title!: string;
  @IsString() @MinLength(30) description!: string;
  @IsIn(["fixed", "starting_from", "per_hour", "per_session", "custom_quote"])
  pricingType!:
    "fixed" | "starting_from" | "per_hour" | "per_session" | "custom_quote";
  @IsOptional() @IsInt() @Min(0) priceMinor?: number;
  @IsOptional() @Length(3, 3) currency = "NGN";
}
export class UpdateServiceDto {
  @IsOptional() @IsString() @MinLength(3) title?: string;
  @IsOptional() @IsString() @MinLength(30) description?: string;
  @IsOptional() @IsIn(["fixed", "starting_from", "per_hour", "per_session", "custom_quote"])
  pricingType?: "fixed" | "starting_from" | "per_hour" | "per_session" | "custom_quote";
  @IsOptional() @IsInt() @Min(0) priceMinor?: number;
  @IsOptional() @IsIn(["draft", "active", "paused", "archived"])
  status?: "draft" | "active" | "paused" | "archived";
}
export class CreateRequestDto {
  @IsUUID() providerId!: string;
  @IsUUID() serviceId!: string;
  @IsString() @MinLength(20) description!: string;
  @IsOptional() @IsInt() @Min(0) budgetMinMinor?: number;
  @IsOptional() @IsInt() @Min(0) budgetMaxMinor?: number;
  @IsOptional() @IsDateString() requestedAt?: string;
  @IsOptional() @IsString() location?: string;
}
export class CreateQuoteDto {
  @IsUUID() requestId!: string;
  @IsInt() @Min(1) amountMinor!: number;
  @IsArray() @ArrayMinSize(1) @IsString({ each: true }) scope!: string[];
  @IsOptional() @IsDateString() deliveryAt?: string;
  @IsOptional() @IsString() notes?: string;
  @IsDateString() expiresAt!: string;
}
export class MessageDto {
  @IsString() @MinLength(1) content!: string;
}
export class ReviewDto {
  @IsUUID() jobId!: string;
  @IsInt() @Min(1) @Max(5) rating!: number;
  @IsString() @MinLength(5) comment!: string;
}
export class DisputeDto {
  @IsString() @MinLength(3) reason!: string;
  @IsString() @MinLength(20) description!: string;
}
