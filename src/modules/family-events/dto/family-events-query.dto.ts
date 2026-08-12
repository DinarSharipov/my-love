import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

export class FamilyEventsQueryDto {
  @ApiPropertyOptional({
    format: 'date',
    example: '2026-08-01',
    description: 'Start date, inclusive, in APP_TIMEZONE',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  dateFrom?: string;

  @ApiPropertyOptional({
    format: 'date',
    example: '2026-09-01',
    description: 'End date, exclusive, in APP_TIMEZONE',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  dateTo?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
