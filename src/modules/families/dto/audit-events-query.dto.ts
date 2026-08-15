import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class AuditEventsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'family.archived' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  action?: string;

  @ApiPropertyOptional({ example: 'family' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  resourceType?: string;
}
