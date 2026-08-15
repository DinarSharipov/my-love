import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksQueryDto } from './dto/tasks-query.dto';
import { TaskResponseDto } from './dto/task-response.dto';
import { TasksService } from './tasks.service';
@ApiTags('tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'families/me/tasks', version: '1' })
export class TasksController {
  constructor(private readonly tasks: TasksService) {}
  @Post() @ApiOkResponse({ type: TaskResponseDto }) create(
    @CurrentUser() u: AuthenticatedUser,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasks.create(u.id, dto);
  }
  @Get() @ApiOkResponse() list(@CurrentUser() u: AuthenticatedUser, @Query() q: TasksQueryDto) {
    return this.tasks.list(u.id, q);
  }
  @Patch(':id') @ApiOkResponse({ type: TaskResponseDto }) update(
    @Param('id') id: string,
    @CurrentUser() u: AuthenticatedUser,
    @Body() dto: UpdateTaskDto,
    @Headers('if-match') ifMatch?: string,
  ) {
    return this.tasks.update(
      id,
      u.id,
      dto,
      ifMatch ? Number(ifMatch.replace(/"/g, '')) : undefined,
    );
  }
  @Post(':id/complete') @ApiOkResponse({ type: TaskResponseDto }) complete(
    @Param('id') id: string,
    @CurrentUser() u: AuthenticatedUser,
    @Headers('if-match') h?: string,
  ) {
    return this.tasks.setCompleted(id, u.id, true, h ? Number(h.replace(/"/g, '')) : undefined);
  }
  @Post(':id/reopen') @ApiOkResponse({ type: TaskResponseDto }) reopen(
    @Param('id') id: string,
    @CurrentUser() u: AuthenticatedUser,
    @Headers('if-match') h?: string,
  ) {
    return this.tasks.setCompleted(id, u.id, false, h ? Number(h.replace(/"/g, '')) : undefined);
  }
  @Delete(':id') @HttpCode(HttpStatus.NO_CONTENT) @ApiNoContentResponse() archive(
    @Param('id') id: string,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.tasks.archive(id, u.id);
  }
}
