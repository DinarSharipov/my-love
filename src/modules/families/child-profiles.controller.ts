import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ConcurrencyVersion } from '../../common/decorators/concurrency-version.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { ChildProfilesService } from './child-profiles.service';
import {
  ChildProfileResponseDto,
  ChildProfileExportDto,
  CreateChildProfileDto,
  UpdateChildProfileDto,
} from './dto/child-profile.dto';

@ApiTags('child-profiles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'families/me/children', version: '1' })
export class ChildProfilesController {
  constructor(private readonly children: ChildProfilesService) {}
  @Post()
  @ApiCreatedResponse({ type: ChildProfileResponseDto })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateChildProfileDto) {
    return this.children.create(user.id, dto);
  }
  @Get()
  @ApiOkResponse({ type: [ChildProfileResponseDto] })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.children.list(user.id);
  }
  @Get('archived')
  @ApiOkResponse({ type: [ChildProfileResponseDto] })
  listArchived(@CurrentUser() user: AuthenticatedUser) {
    return this.children.listArchived(user.id);
  }
  @Get(':id/export')
  @ApiOkResponse({ type: ChildProfileExportDto })
  @ApiNotFoundResponse()
  export(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.children.export(user.id, id);
  }
  @Patch(':id')
  @ApiOkResponse({ type: ChildProfileResponseDto })
  @ApiNotFoundResponse()
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateChildProfileDto,
    @ConcurrencyVersion() expectedVersion?: number,
  ) {
    return this.children.update(user.id, id, dto, expectedVersion);
  }
  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ChildProfileResponseDto })
  restore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @ConcurrencyVersion() expectedVersion?: number,
  ) {
    return this.children.restore(user.id, id, expectedVersion);
  }
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @ConcurrencyVersion() expectedVersion?: number,
  ) {
    return this.children.archive(user.id, id, expectedVersion);
  }
}
