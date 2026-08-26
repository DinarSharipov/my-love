import { Type } from 'class-transformer';
import { IsString, IsUUID, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { CreateMessageDto } from './create-message.dto';

export class ConversationEventDto {
  @IsUUID('4')
  conversationId!: string;
}

export class SendMessageEventDto extends ConversationEventDto {
  @ValidateNested()
  @Type(() => CreateMessageDto)
  message!: CreateMessageDto;
}

export class ReadMessageEventDto extends ConversationEventDto {
  @IsUUID('4')
  messageId!: string;
}

export class MessageEventDto extends ConversationEventDto {
  @IsUUID('4')
  messageId!: string;
}

export class EditMessageEventDto extends MessageEventDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  text!: string;
}
