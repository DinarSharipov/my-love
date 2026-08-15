import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class ExchangeTelegramLinkDto {
  @ApiProperty({ minLength: 32, maxLength: 128 })
  @IsString()
  @Length(32, 128)
  token: string;

  @ApiProperty({ example: '123456789', maxLength: 64 })
  @IsString()
  @IsNotEmpty()
  @Length(1, 64)
  telegramUserId: string;

  @ApiProperty({ example: '123456789', maxLength: 64 })
  @IsString()
  @IsNotEmpty()
  @Length(1, 64)
  chatId: string;
}

export class TelegramIntegrationQueryDto {
  @ApiProperty({ example: '123456789', maxLength: 64 })
  @IsString()
  @IsNotEmpty()
  @Length(1, 64)
  telegramUserId: string;
}

export class TelegramLinkTokenResponseDto {
  @ApiProperty() token: string;
  @ApiProperty({ format: 'date-time' }) expiresAt: Date;
}

export class TelegramLinkExchangeResponseDto {
  @ApiProperty() linked: boolean;
  @ApiProperty({ format: 'uuid' }) connectionId: string;
}

export class TelegramConnectionResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() telegramUserId: string;
  @ApiProperty() status: string;
  @ApiProperty({ format: 'date-time' }) linkedAt: Date;
  @ApiPropertyOptional({ format: 'date-time', nullable: true }) revokedAt: Date | null;
}

export class TelegramIntegrationConnectionResponseDto {
  @ApiProperty() status: string;
  @ApiProperty({ format: 'date-time' }) linkedAt: Date;
  @ApiPropertyOptional({ format: 'date-time', nullable: true }) revokedAt: Date | null;
}
