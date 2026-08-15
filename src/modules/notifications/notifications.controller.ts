import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { NotificationsService } from './notifications.service';
import { NotificationPreferencesService } from './preferences.service';
import {
  NotificationPreferencesResponseDto,
  UpdateNotificationPreferencesDto,
} from './dto/notification-preferences.dto';
@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly preferences: NotificationPreferencesService,
  ) {}
  @Get('preferences') @ApiOkResponse({ type: NotificationPreferencesResponseDto }) preferencesGet(
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.preferences.get(u.id);
  }
  @Patch('preferences')
  @ApiOkResponse({ type: NotificationPreferencesResponseDto })
  preferencesUpdate(
    @CurrentUser() u: AuthenticatedUser,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.preferences.update(u.id, dto);
  }
  @Get() @ApiOkResponse() list(@CurrentUser() u: AuthenticatedUser) {
    return this.notifications.list(u.id);
  }
  @Patch(':id/read') @HttpCode(HttpStatus.NO_CONTENT) @ApiNoContentResponse() read(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.notifications.markRead(u.id, id);
  }
  @Patch('read-all') @HttpCode(HttpStatus.NO_CONTENT) @ApiNoContentResponse() readAll(
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.notifications.markAllRead(u.id);
  }
}
