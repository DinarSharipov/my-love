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
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ConcurrencyVersion } from '../../common/decorators/concurrency-version.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import {
  CreateEmergencyContactDto,
  EmergencyContactResponseDto,
  UpdateEmergencyContactDto,
} from './dto/emergency-contact.dto';
import { EmergencyContactsService } from './emergency-contacts.service';

@ApiTags('emergency-contacts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'families/me/emergency-contacts', version: '1' })
export class EmergencyContactsController {
  constructor(private readonly contacts: EmergencyContactsService) {}
  @Get() @ApiOkResponse({ type: [EmergencyContactResponseDto] }) list(
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.contacts.list(u.id);
  }
  @Get('archived') @ApiOkResponse({ type: [EmergencyContactResponseDto] }) archived(
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.contacts.list(u.id, true);
  }
  @Post() @ApiCreatedResponse({ type: EmergencyContactResponseDto }) create(
    @CurrentUser() u: AuthenticatedUser,
    @Body() dto: CreateEmergencyContactDto,
  ) {
    return this.contacts.create(u.id, dto);
  }
  @Patch(':id') @ApiOkResponse({ type: EmergencyContactResponseDto }) update(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateEmergencyContactDto,
    @ConcurrencyVersion() version?: number,
  ) {
    return this.contacts.update(u.id, id, dto, version);
  }
  @Delete(':id') @HttpCode(HttpStatus.NO_CONTENT) @ApiNoContentResponse() archive(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
    @ConcurrencyVersion() version?: number,
  ) {
    return this.contacts.archive(u.id, id, version);
  }
  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: EmergencyContactResponseDto })
  restore(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
    @ConcurrencyVersion() version?: number,
  ) {
    return this.contacts.restore(u.id, id, version);
  }
}
