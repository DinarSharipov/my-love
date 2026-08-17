import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Task, TaskPriority, TaskStatus } from '@prisma/client';
export class TaskResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) familyId: string;
  @ApiProperty({ format: 'uuid' }) createdById: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) assignedToId: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) childId: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) completedById: string | null;
  @ApiProperty() title: string;
  @ApiPropertyOptional({ nullable: true }) description: string | null;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true }) dueAt: Date | null;
  @ApiProperty({ enum: TaskPriority }) priority: TaskPriority;
  @ApiProperty({ enum: TaskStatus }) status: TaskStatus;
  @ApiProperty() version: number;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  completedAt: Date | null;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt: Date;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt: Date;
  static fromEntity(task: Task): TaskResponseDto {
    return task;
  }
}
