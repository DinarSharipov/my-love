import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { RemindersService } from './reminders.service';
import { CreateTaskReminderDto, TaskReminderResponseDto } from './dto/task-reminder.dto';
@ApiTags('reminders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'families/me/tasks', version: '1' })
export class RemindersController {
  constructor(private readonly reminders: RemindersService) {}
  @Post(':taskId/reminders')
  @ApiCreatedResponse({ type: TaskReminderResponseDto })
  create(
    @CurrentUser() u: AuthenticatedUser,
    @Param('taskId') id: string,
    @Body() dto: CreateTaskReminderDto,
  ) {
    return this.reminders.create(u.id, id, dto.remindAt);
  }
  @Get(':taskId/reminders')
  @ApiOkResponse({ type: [TaskReminderResponseDto] })
  list(@CurrentUser() u: AuthenticatedUser, @Param('taskId') id: string) {
    return this.reminders.list(u.id, id);
  }
  @Delete('reminders/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  remove(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string) {
    return this.reminders.remove(u.id, id);
  }
}
