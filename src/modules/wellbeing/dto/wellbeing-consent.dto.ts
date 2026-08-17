import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';

export const WELLBEING_SCOPES = ['mood', 'energy', 'stress', 'supportRequest'] as const;
export type WellbeingScope = (typeof WELLBEING_SCOPES)[number];

export class CreateWellbeingConsentDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() recipientId: string;
  @ApiProperty({ enum: WELLBEING_SCOPES, isArray: true })
  @IsArray()
  @IsIn(WELLBEING_SCOPES, { each: true })
  scopes: WellbeingScope[];
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class WellbeingConsentResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) recipientId: string;
  @ApiProperty({ enum: WELLBEING_SCOPES, isArray: true }) scopes: string[];
  @ApiPropertyOptional({ format: 'date-time', nullable: true }) expiresAt: Date | null;
  @ApiPropertyOptional({ format: 'date-time', nullable: true }) revokedAt: Date | null;
}
