import { IsBoolean, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class TelegramChatDto {
  @IsInt() id: number;
  @IsString() type: string;
}

class TelegramFromDto {
  @IsInt() id: number;
  @IsBoolean() is_bot: boolean;
}

class TelegramMessageDto {
  @IsInt() message_id: number;
  @ValidateNested() @Type(() => TelegramChatDto) chat: TelegramChatDto;
  @IsOptional() @ValidateNested() @Type(() => TelegramFromDto) from?: TelegramFromDto;
  @IsOptional() @IsString() text?: string;
}

export class TelegramWebhookDto {
  @IsInt() update_id: number;
  @IsOptional() @ValidateNested() @Type(() => TelegramMessageDto) message?: TelegramMessageDto;
}
