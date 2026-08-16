import { WalletVisibility } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class UpdateWalletDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ enum: WalletVisibility })
  @IsOptional()
  @IsEnum(WalletVisibility)
  visibility?: WalletVisibility;
}
