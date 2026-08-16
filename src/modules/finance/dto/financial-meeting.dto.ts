import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FinancialDecisionStatus, FinancialMeetingStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsISO8601, IsOptional, IsString, Length } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateFinancialMeetingDto {
  @ApiProperty({ maxLength: 200 }) @Transform(trim) @IsString() @Length(1, 200) title: string;
  @ApiProperty({ format: 'date-time' }) @IsISO8601({ strict: true }) scheduledAt: string;
  @ApiPropertyOptional({ maxLength: 5000 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 5000)
  notes?: string;
}

export class UpdateFinancialMeetingDto {
  @ApiPropertyOptional({ maxLength: 200 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string;
  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601({ strict: true })
  scheduledAt?: string;
  @ApiPropertyOptional({ maxLength: 5000, nullable: true })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 5000)
  notes?: string | null;
}

export class CreateFinancialDecisionDto {
  @ApiProperty({ maxLength: 200 }) @Transform(trim) @IsString() @Length(1, 200) title: string;
  @ApiPropertyOptional({ maxLength: 5000 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 5000)
  description?: string;
}

export class RespondFinancialDecisionDto {
  @ApiProperty({ enum: ['AGREED', 'REJECTED'] })
  @IsEnum(['AGREED', 'REJECTED'])
  status: 'AGREED' | 'REJECTED';
}

export class FinancialDecisionResponseDto {
  id: string;
  meetingId: string;
  createdById: string;
  respondedById: string | null;
  title: string;
  description: string | null;
  status: FinancialDecisionStatus;
  respondedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export class FinancialMeetingResponseDto {
  id: string;
  createdById: string;
  title: string;
  scheduledAt: Date;
  notes: string | null;
  status: FinancialMeetingStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  decisions: FinancialDecisionResponseDto[];
}
