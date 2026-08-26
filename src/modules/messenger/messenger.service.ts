import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConversationMemberRole, ConversationType, MessageType, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { FamilyMembershipService } from '../family-members/family-membership.service';
import { PrismaService } from '../../database/prisma.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { MessagesQueryDto } from './dto/messages-query.dto';
import { MediaService } from '../media/media.service';

const conversationInclude = {
  members: {
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
    },
  },
} as const;

@Injectable()
export class MessengerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: FamilyMembershipService,
    private readonly mediaService: MediaService,
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
    return this.prisma.conversation.create({
      data: {
        id: randomUUID(),
        familyId: context.familyId,
        createdById: userId,
        type: dto.type,
        title: dto.type === ConversationType.DIRECT ? null : dto.title,
        members: {
          create: memberIds.map((id) => ({ userId: id, role: id === userId ? 'OWNER' : 'MEMBER' })),
        },
      },
      include: conversationInclude,
    });
  }

  async listConversations(userId: string) {
    const { familyId } = await this.membership.requireMembership(userId);
    return this.prisma.conversation.findMany({
      where: { familyId, status: 'ACTIVE', members: { some: { userId } } },
      orderBy: { updatedAt: 'desc' },
      include: conversationInclude,
    });
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
      include: {
        sender: { select: { id: true, firstName: true, lastName: true } },
        media: { include: { media: true } },
      },
    });
    return {
      items: query.afterId ? messages : messages.reverse(),
      hasMore: messages.length === query.limit,
      nextCursor: messages.length ? messages[messages.length - 1].id : null,
    };
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
        sender: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (existing) return existing;
    if (dto.mediaIds?.length) {
      const media = await this.prisma.media.findMany({
        where: { id: { in: dto.mediaIds }, familyId: conversation.familyId },
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
    return this.prisma.$transaction(async (tx) =>
      tx.message.create({
        data: {
          conversationId,
          senderId: userId,
          clientMessageId: dto.clientMessageId,
          type: dto.type,
          text: dto.text?.trim() || null,
          media: { create: (dto.mediaIds ?? []).map((mediaId) => ({ mediaId })) },
        },
        include: {
          sender: { select: { id: true, firstName: true, lastName: true } },
          media: { include: { media: true } },
        },
      }),
    );
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
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { title: title.trim() },
      include: conversationInclude,
    });
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
    return this.requireConversation(userId, conversationId);
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
    return this.requireConversation(userId, conversationId);
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

  async updateMessage(userId: string, conversationId: string, messageId: string, text: string) {
    await this.requireConversation(userId, conversationId);
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, conversationId, senderId: userId, deletedAt: null },
    });
    if (!message) throw new NotFoundException('Message not found');
    if (message.type !== MessageType.TEXT)
      throw new BadRequestException('Only text messages can be edited');
    return this.prisma.message.update({
      where: { id: messageId },
      data: { text: text.trim() },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true } },
        media: { include: { media: true } },
      },
    });
  }

  async deleteMessage(userId: string, conversationId: string, messageId: string) {
    await this.requireConversation(userId, conversationId);
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, conversationId, senderId: userId, deletedAt: null },
    });
    if (!message) throw new NotFoundException('Message not found');
    return this.prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date(), text: null },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true } },
        media: { include: { media: true } },
      },
    });
  }
}
