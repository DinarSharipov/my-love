import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateFamilyEventDto {
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Optional child profile this event concerns',
  })
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsUUID('4')
  childId?: string | null;

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

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 525600,
    nullable: true,
    description: 'Send the first reminder this many minutes before the event',
  })
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsInt()
  @Min(1)
  @Max(525600)
  reminderOffsetMinutes?: number | null;

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    nullable: true,
    description: 'Family member IDs that receive both configured reminders',
  })
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  reminderRecipientIds?: string[] | null;

  @ApiPropertyOptional({
    format: 'date-time',
    nullable: true,
    description: 'Optional second reminder time in ISO 8601 format',
  })
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsDateString({ strict: true })
  repeatReminderAt?: string | null;
}
