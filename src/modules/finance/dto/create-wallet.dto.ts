import { WalletType, WalletVisibility } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class CreateWalletDto {
  @ApiProperty({ enum: WalletType })
  @IsEnum(WalletType)
  type: WalletType;

  @ApiProperty({ maxLength: 120 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({ enum: WalletVisibility })
  @IsOptional()
  @IsEnum(WalletVisibility)
  visibility?: WalletVisibility;

  @ApiPropertyOptional({ example: 'RUB', pattern: '^[A-Z]{3}$' })
  @Transform(upper)
  @IsOptional()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;
}
