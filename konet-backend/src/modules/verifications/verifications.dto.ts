import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, ValidateIf } from "class-validator";
import { ListQuery } from "../contracts/contract.dto";
export class VerificationQuery extends ListQuery {
  @ApiPropertyOptional({
    enum: ["pending", "verified", "rejected", "requires_more_information"],
    default: "pending",
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsIn(["pending", "verified", "rejected", "requires_more_information"])
  status:
    | "pending"
    | "verified"
    | "rejected"
    | "requires_more_information"
    | undefined = undefined;
}
