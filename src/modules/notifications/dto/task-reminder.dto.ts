import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class CreateTaskReminderDto {
  @ApiProperty({ type: String, format: 'date-time' })
  @IsDateString({ strict: true })
  remindAt: string;
}

export class TaskReminderResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) taskId: string;
  @ApiProperty({ format: 'uuid' }) userId: string;
  @ApiProperty({ type: String, format: 'date-time' }) remindAt: Date;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) sentAt: Date | null;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt: Date;
}
