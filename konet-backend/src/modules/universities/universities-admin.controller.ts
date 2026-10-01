import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "../../common/guards/auth.guard";
import {
  AuthUser,
  CurrentUser,
} from "../../common/decorators/current-user.decorator";
import { RequireRoles, StaffGuard } from "../administration/staff.guard";
import {
  CampusInput,
  CampusUpdateInput,
  DomainInput,
  ListQuery,
  UniversityInput,
  UniversityUpdateInput,
} from "../contracts/contract.dto";
import { UniversitiesService } from "./universities.service";

@ApiTags("administration")
@ApiBearerAuth()
@UseGuards(AuthGuard, StaffGuard)
@RequireRoles("admin")
@Controller({ path: "admin/universities", version: "1" })
export class UniversitiesAdminController {
  constructor(private service: UniversitiesService) {}
  @Get() list(@Query() query: ListQuery) {
    return this.service.adminList(query);
  }
  @Post() create(
    @CurrentUser() user: AuthUser,
    @Body() input: UniversityInput,
  ) {
    return this.service.create(user.userId, input);
  }
  @Patch(":id") update(
    @CurrentUser() user: AuthUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() input: UniversityUpdateInput,
  ) {
    return this.service.update(user.userId, id, input);
  }
  @Get(":universityId/campuses") campuses(
    @Param("universityId", new ParseUUIDPipe()) id: string,
  ) {
    return this.service.adminCampuses(id);
  }
  @Post(":universityId/campuses") createCampus(
    @CurrentUser() user: AuthUser,
    @Param("universityId", new ParseUUIDPipe()) id: string,
    @Body() input: CampusInput,
  ) {
    return this.service.createCampus(user.userId, id, input);
  }
  @Patch(":universityId/campuses/:id") updateCampus(
    @CurrentUser() user: AuthUser,
    @Param("universityId", new ParseUUIDPipe()) universityId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() input: CampusUpdateInput,
  ) {
    return this.service.updateCampus(user.userId, universityId, id, input);
  }
  @Delete(":universityId/campuses/:id") @HttpCode(204) async archiveCampus(
    @CurrentUser() user: AuthUser,
    @Param("universityId", new ParseUUIDPipe()) universityId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    await this.service.archiveCampus(user.userId, universityId, id);
  }
  @Get(":universityId/email-domains") domains(
    @Param("universityId", new ParseUUIDPipe()) id: string,
  ) {
    return this.service.domains(id);
  }
  @Post(":universityId/email-domains") createDomain(
    @CurrentUser() user: AuthUser,
    @Param("universityId", new ParseUUIDPipe()) id: string,
    @Body() input: DomainInput,
  ) {
    return this.service.createDomain(user.userId, id, input);
  }
  @Patch(":universityId/email-domains/:id") updateDomain(
    @CurrentUser() user: AuthUser,
    @Param("universityId", new ParseUUIDPipe()) universityId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() input: DomainInput,
  ) {
    return this.service.updateDomain(user.userId, universityId, id, input);
  }
  @Delete(":universityId/email-domains/:id") @HttpCode(204) async deleteDomain(
    @CurrentUser() user: AuthUser,
    @Param("universityId", new ParseUUIDPipe()) universityId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    await this.service.deleteDomain(user.userId, universityId, id);
  }
}

@ApiTags("administration")
@ApiBearerAuth()
@UseGuards(AuthGuard, StaffGuard)
@RequireRoles("admin")
@Controller({ path: "admin/audit-events", version: "1" })
export class DirectoryAuditController {
  constructor(private service: UniversitiesService) {}
  @Get() list(@Query() query: ListQuery) {
    return this.service.audits(query);
  }
}
