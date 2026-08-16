import { WalletType, WalletVisibility } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WalletResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) familyId: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) ownerId: string | null;
  @ApiProperty({ format: 'uuid' }) createdById: string;
  @ApiProperty({ enum: WalletType }) type: WalletType;
  @ApiProperty({ enum: WalletVisibility }) visibility: WalletVisibility;
  @ApiProperty() name: string;
  @ApiProperty({ example: 'RUB' }) currency: string;
  @ApiProperty() version: number;
  @ApiPropertyOptional({ format: 'date-time', nullable: true }) archivedAt: Date | null;
  @ApiProperty({ format: 'date-time' }) createdAt: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt: Date;
}
