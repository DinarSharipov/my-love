import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WalletType, WalletVisibility } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsISO8601, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class CreateFinancialGoalDto {
  @ApiProperty({ maxLength: 200 }) @Transform(trim) @IsString() @Length(1, 200) title: string;
  @ApiProperty({ example: '500000' })
  @IsString()
  @Matches(/^[1-9]\d{0,18}$/)
  targetAmountMinor: string;
  @ApiProperty({ enum: WalletType, description: 'Creates a dedicated goal envelope wallet.' })
  @IsEnum(WalletType)
  type: WalletType;
  @ApiPropertyOptional({ enum: WalletVisibility })
  @IsOptional()
  @IsEnum(WalletVisibility)
  visibility?: WalletVisibility;
  @ApiPropertyOptional({ example: 'RUB', pattern: '^[A-Z]{3}$' })
  @Transform(upper)
  @IsOptional()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;
  @ApiPropertyOptional({ format: 'date', description: 'Optional target calendar date.' })
  @IsOptional()
  @IsISO8601({ strict: true })
  targetDate?: string;
}

export class UpdateFinancialGoalDto {
  @ApiPropertyOptional({ maxLength: 200 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string;
  @ApiPropertyOptional({ example: '500000' })
  @IsOptional()
  @IsString()
  @Matches(/^[1-9]\d{0,18}$/)
  targetAmountMinor?: string;
  @ApiPropertyOptional({ format: 'date', nullable: true })
  @IsOptional()
  @IsISO8601({ strict: true })
  targetDate?: string | null;
}

export class CreateFinancialGoalContributionDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID('4') fromWalletId: string;
  @ApiProperty({ example: '125000' }) @IsString() @Matches(/^[1-9]\d{0,18}$/) amountMinor: string;
  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601({ strict: true })
  occurredAt?: string;
  @ApiPropertyOptional({ maxLength: 500 }) @IsOptional() @IsString() @Length(1, 500) note?: string;
}

export class FinancialGoalResponseDto {
  id: string;
  title: string;
  targetAmountMinor: string;
  currentAmountMinor: string;
  remainingAmountMinor: string;
  currency: string;
  targetDate: string | null;
  achievedAt: Date | null;
  archived: boolean;
  version: number;
  envelope: {
    walletId: string;
    type: WalletType;
    visibility: WalletVisibility;
  };
}

export class FinancialGoalContributionResponseDto {
  id: string;
  goalId: string;
  transactionId: string;
  amountMinor: string;
  occurredAt: Date;
  currentAmountMinor: string;
  achievedAt: Date | null;
}
