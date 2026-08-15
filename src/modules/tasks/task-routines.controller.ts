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
import { ApiBearerAuth, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CreateTaskRoutineDto } from './dto/create-task-routine.dto';
import { TaskRoutineResponseDto } from './dto/task-routine-response.dto';
import { TaskRoutinesService } from './task-routines.service';
@ApiTags('task-routines')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'families/me/task-routines', version: '1' })
export class TaskRoutinesController {
  constructor(private readonly routines: TaskRoutinesService) {}
  @Post() @ApiOkResponse({ type: TaskRoutineResponseDto }) create(
    @CurrentUser() u: AuthenticatedUser,
    @Body() dto: CreateTaskRoutineDto,
  ) {
    return this.routines.create(u.id, dto);
  }
  @Get() @ApiOkResponse({ type: [TaskRoutineResponseDto] }) list(
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.routines.list(u.id);
  }
  @Post(':id/generate') @ApiOkResponse({ type: TaskRoutineResponseDto }) generate(
    @Param('id') id: string,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.routines.generate(id, u.id);
  }
  @Delete(':id') @HttpCode(HttpStatus.NO_CONTENT) @ApiNoContentResponse() archive(
    @Param('id') id: string,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.routines.archive(id, u.id);
  }
}
