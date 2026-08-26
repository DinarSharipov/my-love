import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class MessagesQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;

  @ApiPropertyOptional({ format: 'uuid', description: 'Load messages older than this message' })
  @IsOptional()
  @IsUUID('4')
  beforeId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Load messages newer than this message' })
  @IsOptional()
  @IsUUID('4')
  afterId?: string;
}
