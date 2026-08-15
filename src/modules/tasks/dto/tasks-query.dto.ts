import { IsEnum, IsOptional } from 'class-validator';
import { TaskStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
export class TasksQueryDto extends PaginationQueryDto {
  @IsOptional() @IsEnum(TaskStatus) status?: TaskStatus;
}
