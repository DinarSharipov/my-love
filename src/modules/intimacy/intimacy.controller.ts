import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { IntimacyService } from './intimacy.service';
import {
  IntimacyCalendarDayDto,
  IntimacyCalendarQueryDto,
  IntimacyCheckInResponseDto,
  IntimacyEventResponseDto,
  UpsertIntimacyCheckInDto,
  UpsertIntimacyEventDto,
} from './dto/intimacy.dto';

@ApiTags('intimacy')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'families/me/intimacy', version: '1' })
export class IntimacyController {
  constructor(private readonly service: IntimacyService) {}

  @Get('calendar')
  @ApiOperation({ summary: 'Get privacy-safe intimacy calendar' })
  @ApiOkResponse({ type: IntimacyCalendarDayDto, isArray: true })
  calendar(@CurrentUser() user: AuthenticatedUser, @Query() query: IntimacyCalendarQueryDto) {
    return this.service.calendar(user.id, query.from, query.to);
  }

  @Get('check-ins/:date')
  @ApiOkResponse({ type: IntimacyCheckInResponseDto })
  getCheckIn(@CurrentUser() user: AuthenticatedUser, @Param('date') date: string) {
    return this.service.getCheckIn(user.id, date);
  }

  @Put('check-ins/:date')
  @ApiBody({ type: UpsertIntimacyCheckInDto })
  @ApiOkResponse({ type: IntimacyCheckInResponseDto })
  upsertCheckIn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('date') date: string,
    @Body() dto: UpsertIntimacyCheckInDto,
  ) {
    return this.service.upsertCheckIn(user.id, date, dto);
  }

  @Delete('check-ins/:date')
  @HttpCode(204)
  @ApiNoContentResponse()
  async deleteCheckIn(@CurrentUser() user: AuthenticatedUser, @Param('date') date: string) {
    await this.service.deleteCheckIn(user.id, date);
  }

  @Put('events/:date')
  @ApiBody({ type: UpsertIntimacyEventDto })
  @ApiOkResponse({ type: IntimacyEventResponseDto })
  upsertEvent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('date') date: string,
    @Body() dto: UpsertIntimacyEventDto,
  ) {
    return this.service.upsertEvent(user.id, date, dto);
  }

  @Get('events/:date')
  @ApiOkResponse({ type: IntimacyEventResponseDto })
  getEvent(@CurrentUser() user: AuthenticatedUser, @Param('date') date: string) {
    return this.service.getEvent(user.id, date);
  }

  @Delete('events/:date')
  @HttpCode(204)
  @ApiNoContentResponse()
  async deleteEvent(@CurrentUser() user: AuthenticatedUser, @Param('date') date: string) {
    await this.service.deleteEvent(user.id, date);
  }
}
