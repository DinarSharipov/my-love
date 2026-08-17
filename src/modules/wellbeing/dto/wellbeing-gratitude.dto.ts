import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, Length } from 'class-validator';

export class CreateWellbeingGratitudeDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  recipientId: string;

  @ApiProperty({ minLength: 1, maxLength: 2000 })
  @IsString()
  @Length(1, 2000)
  message: string;
}

export class WellbeingGratitudeResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) authorId: string;
  @ApiProperty({ format: 'uuid' }) recipientId: string;
  @ApiProperty() message: string;
  @ApiProperty() createdAt: Date;
}
