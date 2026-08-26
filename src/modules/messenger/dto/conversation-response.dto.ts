import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConversationStatus, ConversationType } from '@prisma/client';
import { MessageResponseDto } from './message-response.dto';
import { ConversationMemberResponseDto } from './conversation-participant-response.dto';

export class ConversationResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) familyId: string;
  @ApiProperty({ format: 'uuid' }) createdById: string;
  @ApiProperty({ enum: ConversationType }) type: ConversationType;
  @ApiPropertyOptional({ nullable: true }) title: string | null;
  @ApiProperty({ enum: ConversationStatus }) status: ConversationStatus;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt: Date;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt: Date;
  @ApiProperty({ type: [ConversationMemberResponseDto] }) members: ConversationMemberResponseDto[];
  @ApiPropertyOptional({ type: MessageResponseDto, nullable: true })
  lastMessage: MessageResponseDto | null;
  @ApiProperty({ minimum: 0 }) unreadCount: number;
}

export class OperationSuccessResponseDto {
  @ApiProperty({ example: true }) ok: true;
}

export class ReadStateResponseDto {
  @ApiProperty({ format: 'uuid' }) conversationId: string;
  @ApiProperty({ format: 'uuid' }) messageId: string;
  @ApiProperty({ type: String, format: 'date-time' }) readAt: Date;
}
