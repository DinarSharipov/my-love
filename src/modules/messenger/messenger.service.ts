import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ConversationMemberRole,
  ConversationType,
  MediaScope,
  MessageType,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { FamilyMembershipService } from '../family-members/family-membership.service';
import { PrismaService } from '../../database/prisma.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { MessagesQueryDto } from './dto/messages-query.dto';
import { MediaService } from '../media/media.service';
import { ConversationResponseDto } from './dto/conversation-response.dto';
import { ConversationMemberResponseDto } from './dto/conversation-participant-response.dto';
import { MessagePageResponseDto, MessageResponseDto } from './dto/message-response.dto';
import { TransferConversationOwnershipDto } from './dto/transfer-conversation-ownership.dto';
import { MediaResponseDto } from '../media/dto/media-response.dto';
import { PushService } from '../push/push.service';
import { Optional } from '@nestjs/common';

const messengerUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  avatarPreviewObjectKey: true,
  avatarPreviewToken: true,
} as const;

const conversationInclude = {
  members: {
    include: {
      user: { select: messengerUserSelect },
    },
  },
} as const;

@Injectable()
export class MessengerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: FamilyMembershipService,
    private readonly mediaService: MediaService,
    @Optional() private readonly pushService?: PushService,
  ) {}

  async createConversation(userId: string, dto: CreateConversationDto) {
    const context = await this.membership.requireMembership(userId);
    const memberIds = [...new Set([userId, ...dto.memberIds])];
    if (dto.type === ConversationType.DIRECT && memberIds.length !== 2) {
      throw new BadRequestException('A direct conversation must have exactly two members');
    }
    const members = await this.prisma.familyMember.findMany({
      where: {
        familyId: context.familyId,
        userId: { in: memberIds },
        family: { status: 'ACTIVE' },
      },
      select: { userId: true },
    });
    if (members.length !== memberIds.length)
      throw new ForbiddenException('All members must belong to your family');
    const directKey =
      dto.type === ConversationType.DIRECT ? this.createDirectKey(memberIds) : undefined;

    if (directKey) {
      const existing = await this.prisma.conversation.findFirst({
        where: { familyId: context.familyId, directKey },
        include: conversationInclude,
      });
      if (existing) {
        return {
          conversation: await this.toConversationResponse(userId, existing),
          created: false,
        };
      }
    }

    try {
      const conversation = await this.prisma.conversation.create({
        data: {
          id: randomUUID(),
          familyId: context.familyId,
          createdById: userId,
          type: dto.type,
          directKey,
          title: dto.type === ConversationType.DIRECT ? null : dto.title,
          members: {
            create: memberIds.map((id) => ({
              userId: id,
              role: id === userId ? 'OWNER' : 'MEMBER',
            })),
          },
        },
        include: conversationInclude,
      });
      return {
        conversation: await this.toConversationResponse(userId, conversation),
        created: true,
      };
    } catch (error: unknown) {
      if (
        directKey &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.conversation.findFirst({
          where: { familyId: context.familyId, directKey },
          include: conversationInclude,
        });
        if (existing) {
          return {
            conversation: await this.toConversationResponse(userId, existing),
            created: false,
          };
        }
      }
      throw error;
    }
  }

  async listConversations(userId: string) {
    const { familyId } = await this.membership.requireMembership(userId);
    const conversations = await this.prisma.conversation.findMany({
      where: { familyId, status: 'ACTIVE', members: { some: { userId } } },
      orderBy: { updatedAt: 'desc' },
      include: {
        ...conversationInclude,
        messages: {
          where: { deletedAt: null },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 1,
          include: this.messageInclude(),
        },
      },
    });
    return Promise.all(
      conversations.map((conversation) => this.toConversationResponse(userId, conversation)),
    );
  }

  async requireConversation(userId: string, conversationId: string) {
    const { familyId } = await this.membership.requireMembership(userId);
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, familyId, status: 'ACTIVE', members: { some: { userId } } },
      include: conversationInclude,
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }

  async getConversation(userId: string, conversationId: string): Promise<ConversationResponseDto> {
    return this.toConversationResponse(
      userId,
      await this.requireConversation(userId, conversationId),
    );
  }

  async getMessages(userId: string, conversationId: string, query: MessagesQueryDto) {
    await this.requireConversation(userId, conversationId);
    if (query.beforeId && query.afterId) {
      throw new BadRequestException('Use either beforeId or afterId, not both');
    }
    let cursorFilter: Prisma.MessageWhereInput = {};
    const cursorId = query.beforeId ?? query.afterId;
    if (cursorId) {
      const cursor = await this.prisma.message.findFirst({
        where: { id: cursorId, conversationId },
        select: { id: true, createdAt: true },
      });
      if (!cursor) throw new NotFoundException('Message cursor not found');
      const isAfter = Boolean(query.afterId);
      cursorFilter = {
        OR: isAfter
          ? [
              { createdAt: { gt: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { gt: cursor.id } },
            ]
          : [
              { createdAt: { lt: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { lt: cursor.id } },
            ],
      };
    }
    const messages = await this.prisma.message.findMany({
      where: { conversationId, ...cursorFilter },
      orderBy: query.afterId
        ? [{ createdAt: 'asc' }, { id: 'asc' }]
        : [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit,
      include: this.messageInclude(),
    });
    const pageItems = query.afterId ? messages : messages.reverse();
    return {
      items: await Promise.all(pageItems.map((message) => this.toMessageResponse(userId, message))),
      hasMore: messages.length === query.limit,
      // The page is returned oldest -> newest. For beforeId, continue from its oldest item.
      nextCursor: pageItems.length ? pageItems[0].id : null,
    } satisfies MessagePageResponseDto;
  }

  async createMessage(userId: string, conversationId: string, dto: CreateMessageDto) {
    const conversation = await this.requireConversation(userId, conversationId);
    if (dto.type === MessageType.TEXT && (!dto.text?.trim() || dto.mediaIds?.length)) {
      throw new BadRequestException('Text message requires text and cannot include media');
    }
    if (dto.type !== MessageType.TEXT && (!dto.mediaIds?.length || dto.text?.trim())) {
      throw new BadRequestException('Media message requires mediaIds and cannot include text');
    }
    const existing = await this.prisma.message.findFirst({
      where: { senderId: userId, clientMessageId: dto.clientMessageId },
      include: {
        media: { include: { media: true } },
        sender: { select: messengerUserSelect },
      },
    });
    if (existing) return this.toMessageResponse(userId, existing);
    if (dto.mediaIds?.length) {
      const media = await this.prisma.media.findMany({
        where: {
          id: { in: dto.mediaIds },
          familyId: conversation.familyId,
          scope: { in: [MediaScope.ALBUM, MediaScope.CHAT] },
        },
      });
      if (media.length !== dto.mediaIds.length)
        throw new ForbiddenException('Media must belong to the conversation family');
      const expectedKind =
        dto.type === MessageType.IMAGE
          ? 'IMAGE'
          : dto.type === MessageType.VIDEO
            ? 'VIDEO'
            : 'AUDIO';
      if (media.some((item) => item.kind !== expectedKind))
        throw new BadRequestException('Media kind does not match message type');
    }
    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          conversationId,
          senderId: userId,
          clientMessageId: dto.clientMessageId,
          type: dto.type,
          text: dto.text?.trim() || null,
          media: { create: (dto.mediaIds ?? []).map((mediaId) => ({ mediaId })) },
        },
        include: this.messageInclude(),
      });
      if (dto.mediaIds?.length) {
        const claimed = await tx.media.updateMany({
          where: {
            id: { in: dto.mediaIds },
            familyId: conversation.familyId,
            scope: { in: [MediaScope.ALBUM, MediaScope.CHAT] },
          },
          data: { scope: MediaScope.CHAT },
        });
        if (claimed.count !== dto.mediaIds.length) {
          throw new ForbiddenException('Media is reserved for another domain');
        }
      }
      const body =
        created.text?.trim() ??
        (created.type === MessageType.IMAGE
          ? 'Фото'
          : created.type === MessageType.VIDEO
            ? 'Видео'
            : created.type === MessageType.VOICE
              ? 'Голосовое сообщение'
              : null);
      const recipientUserIds = conversation.members
        .map((member) => member.userId)
        .filter((memberId) => memberId !== userId);
      if (this.pushService && body && recipientUserIds.length) {
        await this.pushService.enqueueChatMessagePush(tx, {
          messageId: created.id,
          conversationId: created.conversationId,
          senderId: created.senderId,
          recipientUserIds,
          senderName: `${created.sender.firstName} ${created.sender.lastName}`.trim(),
          body,
          occurredAt: created.createdAt,
        });
      }
      return created;
    });
    return this.toMessageResponse(userId, message);
  }

  async markRead(userId: string, conversationId: string, messageId: string) {
    await this.requireConversation(userId, conversationId);
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, conversationId },
    });
    if (!message) throw new NotFoundException('Message not found');
    return this.prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: message.createdAt, lastReadMessageId: message.id },
    });
  }

  async getFamilyId(userId: string, conversationId: string) {
    const conversation = await this.requireConversation(userId, conversationId);
    return conversation.familyId;
  }

  async getMessageMedia(userId: string, conversationId: string, messageId: string) {
    await this.requireConversation(userId, conversationId);
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, conversationId },
      select: { media: { select: { mediaId: true } } },
    });
    if (!message) throw new NotFoundException('Message not found');
    return this.mediaService.findManyByIds(
      userId,
      message.media.map(({ mediaId }) => mediaId),
    );
  }

  async requireMessageMedia(
    userId: string,
    conversationId: string,
    messageId: string,
    mediaId: string,
  ) {
    await this.requireConversation(userId, conversationId);
    const attachment = await this.prisma.messageMedia.findFirst({
      where: { messageId, mediaId, message: { conversationId } },
      select: { mediaId: true },
    });
    if (!attachment) throw new NotFoundException('Message media not found');
    return attachment.mediaId;
  }

  async updateConversation(userId: string, conversationId: string, title: string) {
    const conversation = await this.requireConversation(userId, conversationId);
    const membership = conversation.members.find((member) => member.userId === userId);
    if (!membership || membership.role === ConversationMemberRole.MEMBER) {
      throw new ForbiddenException('Only group admins can update the conversation');
    }
    if (conversation.type !== ConversationType.GROUP) {
      throw new BadRequestException('Direct conversations cannot be renamed');
    }
    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { title: title.trim() },
      include: conversationInclude,
    });
    return this.toConversationResponse(userId, updated);
  }

  async addMember(userId: string, conversationId: string, memberId: string) {
    const conversation = await this.requireConversation(userId, conversationId);
    const actor = conversation.members.find((member) => member.userId === userId);
    if (!actor || actor.role === ConversationMemberRole.MEMBER) {
      throw new ForbiddenException('Only group admins can manage members');
    }
    if (conversation.type !== ConversationType.GROUP)
      throw new BadRequestException('Members can only be managed in groups');
    const familyMember = await this.prisma.familyMember.findFirst({
      where: { familyId: conversation.familyId, userId: memberId, family: { status: 'ACTIVE' } },
    });
    if (!familyMember) throw new ForbiddenException('User must belong to the conversation family');
    await this.prisma.conversationMember.upsert({
      where: { conversationId_userId: { conversationId, userId: memberId } },
      create: { conversationId, userId: memberId },
      update: {},
    });
    return this.toConversationResponse(
      userId,
      await this.requireConversation(userId, conversationId),
    );
  }

  async removeMember(userId: string, conversationId: string, memberId: string) {
    const conversation = await this.requireConversation(userId, conversationId);
    const actor = conversation.members.find((member) => member.userId === userId);
    const target = conversation.members.find((member) => member.userId === memberId);
    if (!actor || !target || actor.role === ConversationMemberRole.MEMBER)
      throw new ForbiddenException('Only group admins can manage members');
    if (conversation.type !== ConversationType.GROUP)
      throw new BadRequestException('Members can only be managed in groups');
    if (target.role === ConversationMemberRole.OWNER)
      throw new ForbiddenException('The group owner cannot be removed');
    if (actor.role !== ConversationMemberRole.OWNER && target.role === ConversationMemberRole.ADMIN)
      throw new ForbiddenException('Only the owner can remove an admin');
    await this.prisma.conversationMember.delete({
      where: { conversationId_userId: { conversationId, userId: memberId } },
    });
    return this.toConversationResponse(
      userId,
      await this.requireConversation(userId, conversationId),
    );
  }

  async leaveConversation(userId: string, conversationId: string) {
    const conversation = await this.requireConversation(userId, conversationId);
    const member = conversation.members.find((item) => item.userId === userId);
    if (member?.role === ConversationMemberRole.OWNER)
      throw new ForbiddenException('The group owner must transfer ownership before leaving');
    await this.prisma.conversationMember.delete({
      where: { conversationId_userId: { conversationId, userId } },
    });
    return { ok: true };
  }

  async transferOwnership(
    userId: string,
    conversationId: string,
    dto: TransferConversationOwnershipDto,
  ): Promise<ConversationResponseDto> {
    const conversation = await this.requireConversation(userId, conversationId);
    const actor = conversation.members.find((member) => member.userId === userId);
    const target = conversation.members.find((member) => member.userId === dto.userId);
    if (conversation.type !== ConversationType.GROUP)
      throw new BadRequestException('Ownership can only be transferred in groups');
    if (!actor || actor.role !== ConversationMemberRole.OWNER)
      throw new ForbiddenException('Only the group owner can transfer ownership');
    if (!target) throw new NotFoundException('New owner must be a conversation member');
    if (target.userId === userId) throw new BadRequestException('New owner must be another member');
    await this.prisma.$transaction([
      this.prisma.conversationMember.update({
        where: { conversationId_userId: { conversationId, userId } },
        data: { role: ConversationMemberRole.ADMIN },
      }),
      this.prisma.conversationMember.update({
        where: { conversationId_userId: { conversationId, userId: dto.userId } },
        data: { role: ConversationMemberRole.OWNER },
      }),
    ]);
    return this.toConversationResponse(
      userId,
      await this.requireConversation(userId, conversationId),
    );
  }

  async updateMessage(userId: string, conversationId: string, messageId: string, text: string) {
    await this.requireConversation(userId, conversationId);
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, conversationId, senderId: userId, deletedAt: null },
    });
    if (!message) throw new NotFoundException('Message not found');
    if (message.type !== MessageType.TEXT)
      throw new BadRequestException('Only text messages can be edited');
    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { text: text.trim() },
      include: this.messageInclude(),
    });
    return this.toMessageResponse(userId, updated);
  }

  async deleteMessage(userId: string, conversationId: string, messageId: string) {
    await this.requireConversation(userId, conversationId);
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, conversationId, senderId: userId, deletedAt: null },
    });
    if (!message) throw new NotFoundException('Message not found');
    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date(), text: null },
      include: this.messageInclude(),
    });
    return this.toMessageResponse(userId, updated);
  }

  private messageInclude() {
    return {
      sender: { select: messengerUserSelect },
      media: { include: { media: true } },
    } as const;
  }

  private createDirectKey(memberIds: string[]): string {
    return [...memberIds].sort().join(':');
  }

  private async toConversationResponse(
    userId: string,
    conversation: {
      id: string;
      familyId: string;
      createdById: string;
      type: ConversationType;
      title: string | null;
      status: 'ACTIVE' | 'ARCHIVED';
      createdAt: Date;
      updatedAt: Date;
      members: Array<Parameters<typeof ConversationMemberResponseDto.fromEntity>[0]>;
      messages?: Array<Parameters<MessengerService['toMessageResponse']>[1]>;
    },
  ): Promise<ConversationResponseDto> {
    const currentMember = conversation.members.find((member) => member.userId === userId);
    const unreadCount = await this.prisma.message.count({
      where: {
        conversationId: conversation.id,
        senderId: { not: userId },
        deletedAt: null,
        ...(currentMember?.lastReadAt
          ? {
              OR: [
                { createdAt: { gt: currentMember.lastReadAt } },
                {
                  createdAt: currentMember.lastReadAt,
                  id: { gt: currentMember.lastReadMessageId ?? '' },
                },
              ],
            }
          : {}),
      },
    });
    return {
      id: conversation.id,
      familyId: conversation.familyId,
      createdById: conversation.createdById,
      type: conversation.type,
      title: conversation.title,
      status: conversation.status,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      members: conversation.members.map((member) =>
        ConversationMemberResponseDto.fromEntity(member),
      ),
      lastMessage: conversation.messages?.[0]
        ? await this.toMessageResponse(userId, conversation.messages[0])
        : null,
      unreadCount,
    };
  }

  private async toMessageResponse(
    userId: string,
    message: {
      id: string;
      conversationId: string;
      senderId: string;
      clientMessageId: string;
      type: MessageType;
      text: string | null;
      createdAt: Date;
      updatedAt: Date;
      deletedAt: Date | null;
      sender: Parameters<typeof ConversationMemberResponseDto.fromEntity>[0]['user'];
      media: Array<{ mediaId: string; createdAt: Date }>;
    },
  ): Promise<MessageResponseDto> {
    const mediaById = new Map<string, MediaResponseDto>(
      (
        await this.mediaService.findManyByIds(
          userId,
          message.media.map((attachment) => attachment.mediaId),
        )
      ).map((media) => [media.id, media]),
    );
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      clientMessageId: message.clientMessageId,
      type: message.type,
      text: message.text,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      deletedAt: message.deletedAt,
      sender: {
        id: message.sender.id,
        firstName: message.sender.firstName,
        lastName: message.sender.lastName,
        avatarUrl:
          message.sender.avatarPreviewObjectKey && message.sender.avatarPreviewToken
            ? `/api/v1/users/${message.sender.id}/avatar?token=${encodeURIComponent(
                message.sender.avatarPreviewToken,
              )}`
            : null,
      },
      media: message.media.map((attachment) => ({
        mediaId: attachment.mediaId,
        createdAt: attachment.createdAt,
        media: mediaById.get(attachment.mediaId)!,
      })),
    };
  }
}
