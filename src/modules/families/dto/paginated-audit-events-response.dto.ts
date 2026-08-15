import { ApiProperty } from '@nestjs/swagger';
import { PaginationResponseDto } from '../../../common/dto/pagination-response.dto';
import { AuditEventResponseDto } from './audit-event-response.dto';

export class PaginatedAuditEventsResponseDto extends PaginationResponseDto {
  @ApiProperty({ type: [AuditEventResponseDto] }) data: AuditEventResponseDto[];
}
