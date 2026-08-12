import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateFamilyEventDto {
  @ApiProperty({ example: 'Ужин в ресторане', maxLength: 200 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({
    format: 'date-time',
    example: '2026-09-20T16:00:00.000Z',
    description: 'Event date and time in ISO 8601 format',
  })
  @IsDateString({ strict: true })
  scheduledAt: string;

  @ApiProperty({ example: 'Москва, ул. Тверская, 1', maxLength: 500 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  location: string;
}
