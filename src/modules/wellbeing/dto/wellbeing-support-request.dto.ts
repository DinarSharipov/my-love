import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID, Length } from 'class-validator';

export enum WellbeingSupportRequestStatus {
  OPEN = 'OPEN',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  CLOSED = 'CLOSED',
}

export class CreateWellbeingSupportRequestDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  recipientId!: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @Length(1, 2000)
  message?: string;
}

export class UpdateWellbeingSupportRequestDto {
  @ApiProperty({ enum: WellbeingSupportRequestStatus })
  @IsEnum(WellbeingSupportRequestStatus)
  status!: WellbeingSupportRequestStatus;
}

export class WellbeingSupportRequestResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) requesterId!: string;
  @ApiProperty({ format: 'uuid' }) recipientId!: string;
  @ApiPropertyOptional() message!: string | null;
  @ApiProperty({ enum: WellbeingSupportRequestStatus }) status!: WellbeingSupportRequestStatus;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
