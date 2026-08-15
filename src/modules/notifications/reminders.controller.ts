import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsDateString, IsString } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { RemindersService } from './reminders.service';
class CreateReminderDto {
  @IsString() @IsDateString({ strict: true }) remindAt: string;
}
@ApiTags('reminders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'families/me/tasks', version: '1' })
export class RemindersController {
  constructor(private readonly reminders: RemindersService) {}
  @Post(':taskId/reminders') create(
    @CurrentUser() u: AuthenticatedUser,
    @Param('taskId') id: string,
    @Body() dto: CreateReminderDto,
  ) {
    return this.reminders.create(u.id, id, dto.remindAt);
  }
  @Get(':taskId/reminders') list(@CurrentUser() u: AuthenticatedUser, @Param('taskId') id: string) {
    return this.reminders.list(u.id, id);
  }
  @Delete('reminders/:id') remove(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string) {
    return this.reminders.remove(u.id, id);
  }
}
