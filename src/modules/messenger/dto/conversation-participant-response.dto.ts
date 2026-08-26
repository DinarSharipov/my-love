import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConversationMemberRole } from '@prisma/client';

type MessengerUser = {
  id: string;
  firstName: string;
  lastName: string;
  avatarPreviewObjectKey: string | null;
  avatarPreviewToken: string | null;
};

export class ConversationParticipantResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() firstName: string;
  @ApiProperty() lastName: string;
  @ApiPropertyOptional({ format: 'uri', nullable: true }) avatarUrl: string | null;

  static fromEntity(user: MessengerUser): ConversationParticipantResponseDto {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl:
        user.avatarPreviewObjectKey && user.avatarPreviewToken
          ? `/api/v1/users/${user.id}/avatar?token=${encodeURIComponent(user.avatarPreviewToken)}`
          : null,
    };
  }
}

export class ConversationMemberResponseDto {
  @ApiProperty({ format: 'uuid' }) userId: string;
  @ApiProperty({ enum: ConversationMemberRole }) role: ConversationMemberRole;
  @ApiProperty({ type: String, format: 'date-time' }) joinedAt: Date;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  lastReadAt: Date | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) lastReadMessageId: string | null;
  @ApiProperty({ type: ConversationParticipantResponseDto })
  user: ConversationParticipantResponseDto;

  static fromEntity(member: {
    userId: string;
    role: ConversationMemberRole;
    joinedAt: Date;
    lastReadAt: Date | null;
    lastReadMessageId: string | null;
    user: MessengerUser;
  }): ConversationMemberResponseDto {
    return {
      userId: member.userId,
      role: member.role,
      joinedAt: member.joinedAt,
      lastReadAt: member.lastReadAt,
      lastReadMessageId: member.lastReadMessageId,
      user: ConversationParticipantResponseDto.fromEntity(member.user),
    };
  }
}
