import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CalendarService } from './calendar.service';
import { CalendarQueryDto } from './dto/calendar-query.dto';
import { CalendarProjectionResponseDto } from './dto/calendar-response.dto';

@ApiTags('calendar')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'families/me/calendar', version: '1' })
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get()
  @ApiOkResponse({ type: CalendarProjectionResponseDto })
  project(@CurrentUser() user: AuthenticatedUser, @Query() query: CalendarQueryDto) {
    return this.calendar.project(user.id, query);
  }
}
