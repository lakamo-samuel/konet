import { ApiProperty } from "@nestjs/swagger";
import { IsString, Length, MaxLength } from "class-validator";
export class StaffEnrollmentInput {
  @ApiProperty({
    description: "Current account password; never stored in audit events",
    maxLength: 128,
  })
  @IsString()
  @Length(1, 128)
  password!: string;
}
export class StaffVerificationInput {
  @ApiProperty({
    description: "Six-digit authenticator code or an unused recovery code",
    maxLength: 64,
  })
  @IsString()
  @Length(6, 64)
  @MaxLength(64)
  code!: string;
}
