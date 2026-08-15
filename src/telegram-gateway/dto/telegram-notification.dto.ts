import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  ValidateNested,
} from 'class-validator';

class TelegramTemplateDataDto {
  @IsString() @Length(1, 200) title: string;
  @IsOptional() @IsString() @Length(1, 1000) body?: string;
}

export class TelegramNotificationDto {
  @IsUUID() eventId: string;
  @IsIn([1]) schemaVersion: 1;
  @IsString() @Length(1, 100) type: string;
  @IsUUID() recipientUserId: string;
  @IsString() @Length(1, 64) recipientChatId: string;
  @IsObject()
  @ValidateNested()
  @Type(() => TelegramTemplateDataDto)
  templateData: TelegramTemplateDataDto;
  @IsString() @Length(2, 35) locale: string;
  @IsString() @Length(1, 100) timeZone: string;
  @IsDateString() occurredAt: string;
  @IsDateString() availableAt: string;
  @IsOptional() @IsDateString() expiresAt?: string;
  @IsOptional() @IsUrl({ require_protocol: true }) deepLink?: string;
}
