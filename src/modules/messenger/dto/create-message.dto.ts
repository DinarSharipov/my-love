import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';
import { MessageType } from '@prisma/client';

export class CreateMessageDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  clientMessageId!: string;

  @ApiProperty({ enum: MessageType })
  @IsEnum(MessageType)
  type!: MessageType;

  @ApiPropertyOptional({ maxLength: 4000 })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  text?: string;

  @ApiPropertyOptional({ type: [String], format: 'uuid', maxItems: 10 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  mediaIds?: string[];
}
