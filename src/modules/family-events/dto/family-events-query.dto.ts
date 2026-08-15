import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { IsLocalDate } from '../../../common/validation/date-time.decorators';

export class FamilyEventsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    format: 'date',
    example: '2026-08-01',
    description: 'Start date, inclusive, in the family timezone',
  })
  @IsOptional()
  @IsLocalDate()
  dateFrom?: string;

  @ApiPropertyOptional({
    format: 'date',
    example: '2026-09-01',
    description: 'End date, exclusive, in the family timezone',
  })
  @IsOptional()
  @IsLocalDate()
  dateTo?: string;
}
