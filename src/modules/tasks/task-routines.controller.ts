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
import { ApiBearerAuth, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ConcurrencyVersion } from '../../common/decorators/concurrency-version.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CreateTaskRoutineDto } from './dto/create-task-routine.dto';
import { TaskRoutineResponseDto } from './dto/task-routine-response.dto';
import { UpdateTaskRoutineDto } from './dto/update-task-routine.dto';
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
  @Get('archived') @ApiOkResponse({ type: [TaskRoutineResponseDto] }) listArchived(
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.routines.listArchived(u.id);
  }
  @Patch(':id') @ApiOkResponse({ type: TaskRoutineResponseDto }) update(
    @Param('id') id: string,
    @CurrentUser() u: AuthenticatedUser,
    @Body() dto: UpdateTaskRoutineDto,
    @ConcurrencyVersion() expectedVersion?: number,
  ) {
    return this.routines.update(id, u.id, dto, expectedVersion);
  }
  @Post(':id/generate') @ApiOkResponse({ type: TaskRoutineResponseDto }) generate(
    @Param('id') id: string,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.routines.generate(id, u.id);
  }
  @Post(':id/restore') @ApiOkResponse({ type: TaskRoutineResponseDto }) restore(
    @Param('id') id: string,
    @CurrentUser() u: AuthenticatedUser,
    @ConcurrencyVersion() expectedVersion?: number,
  ) {
    return this.routines.restore(id, u.id, expectedVersion);
  }
  @Delete(':id') @HttpCode(HttpStatus.NO_CONTENT) @ApiNoContentResponse() archive(
    @Param('id') id: string,
    @CurrentUser() u: AuthenticatedUser,
    @ConcurrencyVersion() expectedVersion?: number,
  ) {
    return this.routines.archive(id, u.id, expectedVersion);
  }
}
