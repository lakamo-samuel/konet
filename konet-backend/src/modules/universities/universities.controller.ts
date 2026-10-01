import { Controller, Get, Param, ParseUUIDPipe } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { UniversitiesService } from "./universities.service";
@ApiTags("universities")
@Controller({ path: "universities", version: "1" })
export class UniversitiesController {
  constructor(private service: UniversitiesService) {}
  @Get() list() {
    return this.service.list();
  }
  @Get(":id") one(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.service.one(id);
  }
  @Get(":id/campuses") campuses(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.service.publicCampuses(id);
  }
  @Get(":id/verification-methods") methods(
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.service.verificationMethods(id);
  }
}
