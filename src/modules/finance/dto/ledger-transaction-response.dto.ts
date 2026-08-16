import { LedgerTransactionType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LedgerEntryResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) walletId: string | null;
  @ApiProperty({ example: '-125000', description: 'Signed amount in minor currency units.' })
  amountMinor: string;
  @ApiProperty({ format: 'date-time' }) createdAt: Date;
}

export class LedgerTransactionResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) familyId: string;
  @ApiProperty({ format: 'uuid' }) createdById: string;
  @ApiProperty({ enum: LedgerTransactionType }) type: LedgerTransactionType;
  @ApiProperty({ example: 'RUB' }) currency: string;
  @ApiProperty({ format: 'date-time' }) occurredAt: Date;
  @ApiPropertyOptional({ nullable: true }) note: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) reversesId: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) categoryId: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt: Date;
  @ApiProperty({ type: [LedgerEntryResponseDto] }) entries: LedgerEntryResponseDto[];
}
