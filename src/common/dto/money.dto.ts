import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Matches, Max, Min } from 'class-validator';

export class MoneyDto {
  @ApiProperty({
    description: 'Amount in the smallest currency unit; serialized as a decimal string',
    example: '125000',
    pattern: '^-?\\d+$',
  })
  @IsString()
  @Matches(/^-?\d+$/)
  amountMinor: string;

  @ApiProperty({ description: 'ISO 4217 alphabetic currency code', example: 'RUB' })
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency: string;

  @ApiProperty({ description: 'Number of fractional digits for the currency', example: 2 })
  @IsInt()
  @Min(0)
  @Max(6)
  scale: number;
}
