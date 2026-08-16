import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';

export class CreateLedgerCommandDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  walletId: string;

  @ApiProperty({
    description: 'Positive amount in minor currency units. JSON numbers are not accepted.',
    example: '125000',
  })
  @IsString()
  @Matches(/^[1-9]\d{0,18}$/)
  amountMinor: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601({ strict: true })
  occurredAt?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  note?: string;
}

export class CreateTransferCommandDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  fromWalletId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  toWalletId: string;

  @ApiProperty({
    description: 'Positive amount in minor currency units. JSON numbers are not accepted.',
    example: '125000',
  })
  @IsString()
  @Matches(/^[1-9]\d{0,18}$/)
  amountMinor: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601({ strict: true })
  occurredAt?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  note?: string;
}

export class ReverseLedgerTransactionDto {
  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601({ strict: true })
  occurredAt?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  note?: string;
}
