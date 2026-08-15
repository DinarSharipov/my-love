import { ApiProperty } from '@nestjs/swagger';
import { PaginationResponseDto } from '../../../common/dto/pagination-response.dto';
import { FamilyEventResponseDto } from './family-event-response.dto';

export class PaginatedFamilyEventsResponseDto extends PaginationResponseDto {
  @ApiProperty({ type: [FamilyEventResponseDto] }) data: FamilyEventResponseDto[];
}
