import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessageType } from '@prisma/client';
import { MediaResponseDto } from '../../media/dto/media-response.dto';
import { ConversationParticipantResponseDto } from './conversation-participant-response.dto';

export class MessageMediaResponseDto {
  @ApiProperty({ format: 'uuid' }) mediaId: string;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt: Date;
  @ApiProperty({ type: MediaResponseDto }) media: MediaResponseDto;
}

export class MessageResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) conversationId: string;
  @ApiProperty({ format: 'uuid' }) senderId: string;
  @ApiProperty({ format: 'uuid' }) clientMessageId: string;
  @ApiProperty({ enum: MessageType }) type: MessageType;
  @ApiPropertyOptional({ nullable: true }) text: string | null;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt: Date;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt: Date;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  deletedAt: Date | null;
  @ApiProperty({ type: ConversationParticipantResponseDto })
  sender: ConversationParticipantResponseDto;
  @ApiProperty({ type: [MessageMediaResponseDto] }) media: MessageMediaResponseDto[];
}

export class MessagePageResponseDto {
  @ApiProperty({ type: [MessageResponseDto] }) items: MessageResponseDto[];
  @ApiProperty() hasMore: boolean;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) nextCursor: string | null;
}
