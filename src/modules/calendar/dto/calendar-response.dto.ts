import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum CalendarEntryKind {
  FAMILY_EVENT = 'FAMILY_EVENT',
  TASK = 'TASK',
  TASK_REMINDER = 'TASK_REMINDER',
}

export class CalendarEntryResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ format: 'uuid' }) sourceId: string;
  @ApiProperty({ enum: CalendarEntryKind }) kind: CalendarEntryKind;
  @ApiProperty() title: string;
  @ApiProperty({ type: String, format: 'date-time' }) startsAt: Date;
  @ApiProperty() status: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) assignedToId: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) childId: string | null;
}

export class CalendarProjectionResponseDto {
  @ApiProperty({ format: 'date' }) dateFrom: string;
  @ApiProperty({ format: 'date' }) dateTo: string;
  @ApiProperty() timeZone: string;
  @ApiProperty({ type: [CalendarEntryResponseDto] }) data: CalendarEntryResponseDto[];
  @ApiProperty({ description: 'True when more than 500 matching entries exist' })
  truncated: boolean;
}
