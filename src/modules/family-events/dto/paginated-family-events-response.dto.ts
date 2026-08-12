import { ApiProperty } from '@nestjs/swagger';
import { FamilyEventResponseDto } from './family-event-response.dto';

export class PaginatedFamilyEventsResponseDto {
  @ApiProperty({ type: [FamilyEventResponseDto] }) data: FamilyEventResponseDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalPages: number;
}
