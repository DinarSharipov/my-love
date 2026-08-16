import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RecurringPaymentFrequency, RecurringPaymentType } from '@prisma/client';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateRecurringPaymentDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID('4') walletId: string;
  @ApiProperty({ enum: RecurringPaymentType })
  @IsEnum(RecurringPaymentType)
  type: RecurringPaymentType;
  @ApiProperty({ maxLength: 200 }) @IsString() @Length(1, 200) title: string;
  @ApiProperty({ example: '125000' }) @IsString() @Matches(/^[1-9]\d{0,18}$/) amountMinor: string;
  @ApiProperty({ enum: RecurringPaymentFrequency })
  @IsEnum(RecurringPaymentFrequency)
  frequency: RecurringPaymentFrequency;
  @ApiProperty({ format: 'date-time' }) @IsISO8601({ strict: true }) nextDueAt: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID('4') categoryId?: string;
  @ApiPropertyOptional({ maxLength: 500 }) @IsOptional() @IsString() @Length(1, 500) note?: string;
  @ApiPropertyOptional({ minimum: 1, maximum: 120, default: 1 })
  @IsOptional()
  @Min(1)
  @Max(120)
  interval?: number;
  @ApiPropertyOptional({ minimum: 0, maximum: 525600 })
  @IsOptional()
  @Min(0)
  @Max(525600)
  reminderOffsetMinutes?: number;
  @ApiPropertyOptional({ type: [String], format: 'uuid', description: 'Defaults to the creator.' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  reminderRecipientIds?: string[];
}

export class UpdateRecurringPaymentDto {
  @ApiPropertyOptional({ maxLength: 200 }) @IsOptional() @IsString() @Length(1, 200) title?: string;
  @ApiPropertyOptional({ maxLength: 500 }) @IsOptional() @IsString() @Length(1, 500) note?: string;
  @ApiPropertyOptional({ example: '125000' })
  @IsOptional()
  @IsString()
  @Matches(/^[1-9]\d{0,18}$/)
  amountMinor?: string;
  @ApiPropertyOptional({ enum: RecurringPaymentFrequency })
  @IsOptional()
  @IsEnum(RecurringPaymentFrequency)
  frequency?: RecurringPaymentFrequency;
  @ApiPropertyOptional({ minimum: 1, maximum: 120 })
  @IsOptional()
  @Min(1)
  @Max(120)
  interval?: number;
  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601({ strict: true })
  nextDueAt?: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID('4')
  categoryId?: string;
  @ApiPropertyOptional({ minimum: 0, maximum: 525600, nullable: true })
  @IsOptional()
  @Min(0)
  @Max(525600)
  reminderOffsetMinutes?: number;
  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  reminderRecipientIds?: string[];
  @ApiPropertyOptional() @IsOptional() active?: boolean;
}

export class RecurringPaymentResponseDto {
  id: string;
  walletId: string;
  categoryId?: string | null;
  type: RecurringPaymentType;
  title: string;
  note?: string | null;
  amountMinor: string;
  frequency: RecurringPaymentFrequency;
  interval: number;
  nextDueAt: Date;
  reminderOffsetMinutes?: number | null;
  reminderRecipientIds: string[];
  active: boolean;
  version: number;
}

export class RecurringPaymentForecastResponseDto {
  id: string;
  dueAt: Date;
  reminderAt: Date;
  reminderSentAt?: Date | null;
}
