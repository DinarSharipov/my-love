import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsISO8601, IsOptional, IsString, Length } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateWellbeingCoupleMeetingDto {
  @ApiProperty({ maxLength: 200 }) @Transform(trim) @IsString() @Length(1, 200) title: string;
  @ApiProperty({ format: 'date-time' }) @IsISO8601({ strict: true }) scheduledAt: string;
  @ApiProperty({ type: [String] }) @IsArray() @IsString({ each: true }) sections: string[];
}

export class UpdateWellbeingCoupleMeetingDto {
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
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sections?: string[];
}

export class WellbeingCoupleMeetingResponseDto {
  id: string;
  familyId: string;
  createdById: string;
  title: string;
  scheduledAt: Date;
  sections: string[];
  responses: Record<string, string>;
  publishedAt: Date | null;
  sharedDecision: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class WellbeingCoupleMeetingResponseInputDto {
  @ApiProperty({ maxLength: 5000 }) @Transform(trim) @IsString() @Length(1, 5000) response: string;
}

export class WellbeingCoupleMeetingDecisionDto {
  @ApiProperty({ maxLength: 5000 }) @Transform(trim) @IsString() @Length(1, 5000) decision: string;
}
