import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";
import { ListQuery } from "../contracts/contract.dto";
export class StaffUsersQuery extends ListQuery {
  @ApiPropertyOptional({ format: "email" })
  @IsOptional()
  @IsEmail()
  email?: string;
}
export class StaffRoleInput {
  @ApiProperty({ enum: ["admin", "reviewer", "support", "finance"] })
  @IsIn(["admin", "reviewer", "support", "finance"])
  role!: "admin" | "reviewer" | "support" | "finance";
  @ApiProperty({ minLength: 3 }) @IsString() @MinLength(3) reason!: string;
}
