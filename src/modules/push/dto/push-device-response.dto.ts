import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PushDevicePlatform } from '@prisma/client';

export class PushDeviceResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: PushDevicePlatform }) platform!: PushDevicePlatform;
  @ApiPropertyOptional() appVersion!: string | null;
  @ApiProperty() lastSeenAt!: Date;
  @ApiProperty() createdAt!: Date;
}
