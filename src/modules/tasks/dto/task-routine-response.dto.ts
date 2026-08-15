import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskPriority, TaskRoutine, TaskRoutineFrequency } from '@prisma/client';
export class TaskRoutineResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) familyId: string;
  @ApiProperty({ format: 'uuid' }) createdById: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) assignedToId: string | null;
  @ApiProperty() title: string;
  @ApiPropertyOptional({ nullable: true }) description: string | null;
  @ApiProperty({ enum: TaskPriority }) priority: TaskPriority;
  @ApiProperty({ enum: TaskRoutineFrequency }) frequency: TaskRoutineFrequency;
  @ApiProperty() interval: number;
  @ApiProperty() nextRunAt: Date;
  @ApiProperty() active: boolean;
  @ApiProperty() version: number;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
  static fromEntity(routine: TaskRoutine): TaskRoutineResponseDto {
    return routine;
  }
}
