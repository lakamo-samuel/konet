import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ListQuery, ProviderSearch } from "../contracts/contract.dto";
import { ProvidersService } from "./providers.service";
@ApiTags("providers")
@Controller({ version: "1" })
export class ProvidersController {
  constructor(private service: ProvidersService) {}
  @Get("providers") list(@Query() q: ProviderSearch) {
    return this.service.list(q);
  }
  @Get("providers/:id") one(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.service.one(id);
  }
  @Get("providers/:id/services") services(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Query() q: ListQuery,
  ) {
    return this.service.publicCollection(id, "services", q);
  }
  @Get("providers/:id/portfolio") portfolio(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Query() q: ListQuery,
  ) {
    return this.service.publicCollection(id, "portfolio", q);
  }
  @Get("providers/:id/reviews") reviews(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Query() q: ListQuery,
  ) {
    return this.service.publicCollection(id, "reviews", q);
  }
}
