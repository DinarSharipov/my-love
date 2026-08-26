import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConversationType, MessageType, Prisma } from '@prisma/client';
import { MessengerService } from './messenger.service';

describe('MessengerService', () => {
  const membership = { requireMembership: jest.fn() };
  const prisma = {
    familyMember: { findMany: jest.fn(), findFirst: jest.fn() },
    conversation: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    conversationMember: { upsert: jest.fn(), delete: jest.fn(), update: jest.fn() },
    messageMedia: { findFirst: jest.fn() },
    message: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    media: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const mediaService = { findManyByIds: jest.fn() };
  const service = new MessengerService(prisma as never, membership as never, mediaService as never);

  beforeEach(() => {
    jest.clearAllMocks();
    membership.requireMembership.mockResolvedValue({ familyId: 'family-1' });
    mediaService.findManyByIds.mockResolvedValue([]);
  });

  it('rejects a direct conversation with more than one other member', async () => {
    await expect(
      service.createConversation('user-1', {
        type: ConversationType.DIRECT,
        memberIds: ['user-2', 'user-3'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns an existing direct conversation for the same pair without creating a duplicate', async () => {
    const existing = {
      id: 'conversation-1',
      familyId: 'family-1',
      createdById: 'user-1',
      type: ConversationType.DIRECT,
      title: null,
      status: 'ACTIVE',
      createdAt: new Date('2026-08-26T10:00:00.000Z'),
      updatedAt: new Date('2026-08-26T10:00:00.000Z'),
      members: [
        {
          userId: 'user-1',
          role: 'OWNER',
          lastReadAt: null,
          lastReadMessageId: null,
          user: {
            id: 'user-1',
            firstName: 'User',
            lastName: 'One',
            avatarPreviewObjectKey: null,
            avatarPreviewToken: null,
          },
        },
        {
          userId: 'user-2',
          role: 'MEMBER',
          lastReadAt: null,
          lastReadMessageId: null,
          user: {
            id: 'user-2',
            firstName: 'User',
            lastName: 'Two',
            avatarPreviewObjectKey: null,
            avatarPreviewToken: null,
          },
        },
      ],
    };
    prisma.familyMember.findMany.mockResolvedValue([{ userId: 'user-1' }, { userId: 'user-2' }]);
    prisma.conversation.findFirst.mockResolvedValue(existing);
    prisma.message.count.mockResolvedValue(0);

    await expect(
      service.createConversation('user-1', {
        type: ConversationType.DIRECT,
        memberIds: ['user-2'],
      }),
    ).resolves.toMatchObject({ created: false, conversation: { id: existing.id } });

    expect(prisma.conversation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { familyId: 'family-1', directKey: 'user-1:user-2' } }),
    );
    expect(prisma.conversation.create).not.toHaveBeenCalled();
  });

  it('returns the competing direct conversation after a unique-index race', async () => {
    const existing = {
      id: 'conversation-1',
      familyId: 'family-1',
      createdById: 'user-1',
      type: ConversationType.DIRECT,
      title: null,
      status: 'ACTIVE',
      createdAt: new Date('2026-08-26T10:00:00.000Z'),
      updatedAt: new Date('2026-08-26T10:00:00.000Z'),
      members: [],
    };
    prisma.familyMember.findMany.mockResolvedValue([{ userId: 'user-1' }, { userId: 'user-2' }]);
    prisma.conversation.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(existing);
    prisma.conversation.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.16.0',
      }),
    );
    prisma.message.count.mockResolvedValue(0);

    await expect(
      service.createConversation('user-1', {
        type: ConversationType.DIRECT,
        memberIds: ['user-2'],
      }),
    ).resolves.toMatchObject({ created: false, conversation: { id: existing.id } });
  });

  it('rejects media from another family', async () => {
    prisma.conversation.findFirst.mockResolvedValue({
      id: 'conversation-1',
      familyId: 'family-1',
      members: [{ userId: 'user-1', role: 'OWNER' }],
    });
    prisma.message.findFirst.mockResolvedValue(null);
    prisma.media.findMany.mockResolvedValue([]);

    await expect(
      service.createMessage('user-1', 'conversation-1', {
        clientMessageId: 'client-1',
        type: MessageType.IMAGE,
        mediaIds: ['media-from-other-family'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns an existing message for a duplicate client id', async () => {
    const existing = {
      id: 'message-1',
      conversationId: 'conversation-1',
      senderId: 'user-1',
      clientMessageId: 'client-1',
      type: MessageType.TEXT,
      text: 'hello',
      createdAt: new Date('2026-08-26T10:00:00.000Z'),
      updatedAt: new Date('2026-08-26T10:00:00.000Z'),
      deletedAt: null,
      sender: {
        id: 'user-1',
        firstName: 'User',
        lastName: 'One',
        avatarPreviewObjectKey: null,
        avatarPreviewToken: null,
      },
      media: [],
    };
    prisma.conversation.findFirst.mockResolvedValue({
      id: 'conversation-1',
      familyId: 'family-1',
      members: [{ userId: 'user-1', role: 'MEMBER' }],
    });
    prisma.message.findFirst.mockResolvedValue(existing);

    await expect(
      service.createMessage('user-1', 'conversation-1', {
        clientMessageId: 'client-1',
        type: MessageType.TEXT,
        text: 'hello',
      }),
    ).resolves.toMatchObject({ id: existing.id, sender: { avatarUrl: null }, media: [] });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('allows only the sender to edit a message', async () => {
    prisma.conversation.findFirst.mockResolvedValue({
      id: 'conversation-1',
      familyId: 'family-1',
      members: [{ userId: 'user-2', role: 'MEMBER' }],
    });
    prisma.message.findFirst.mockResolvedValue(null);

    await expect(
      service.updateMessage('user-1', 'conversation-1', 'message-1', 'changed'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns only media attached to the requested message', async () => {
    prisma.conversation.findFirst.mockResolvedValue({
      id: 'conversation-1',
      familyId: 'family-1',
      members: [{ userId: 'user-1', role: 'MEMBER' }],
    });
    prisma.message.findFirst.mockResolvedValue({
      media: [{ mediaId: 'media-1' }, { mediaId: 'media-2' }],
    });
    mediaService.findManyByIds.mockResolvedValue([{ id: 'media-1' }, { id: 'media-2' }]);

    await expect(service.getMessageMedia('user-1', 'conversation-1', 'message-1')).resolves.toEqual(
      [{ id: 'media-1' }, { id: 'media-2' }],
    );
    expect(mediaService.findManyByIds).toHaveBeenCalledWith('user-1', ['media-1', 'media-2']);
  });

  it('does not allow streaming media that is not attached to the message', async () => {
    prisma.conversation.findFirst.mockResolvedValue({
      id: 'conversation-1',
      familyId: 'family-1',
      members: [{ userId: 'user-1', role: 'MEMBER' }],
    });
    prisma.messageMedia.findFirst.mockResolvedValue(null);

    await expect(
      service.requireMessageMedia('user-1', 'conversation-1', 'message-1', 'media-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('uses the oldest item of an older-message page as nextCursor', async () => {
    const makeMessage = (id: string, createdAt: string) => ({
      id,
      conversationId: 'conversation-1',
      senderId: 'user-2',
      clientMessageId: id,
      type: MessageType.TEXT,
      text: id,
      createdAt: new Date(createdAt),
      updatedAt: new Date(createdAt),
      deletedAt: null,
      sender: {
        id: 'user-2',
        firstName: 'User',
        lastName: 'Two',
        avatarPreviewObjectKey: null,
        avatarPreviewToken: null,
      },
      media: [],
    });
    prisma.conversation.findFirst.mockResolvedValue({
      id: 'conversation-1',
      familyId: 'family-1',
      members: [{ userId: 'user-1', role: 'MEMBER', lastReadAt: null, lastReadMessageId: null }],
    });
    prisma.message.findFirst.mockResolvedValue({
      id: 'cursor-3',
      createdAt: new Date('2026-08-26T12:00:00.000Z'),
    });
    prisma.message.findMany.mockResolvedValue([
      makeMessage('message-2', '2026-08-26T11:00:00.000Z'),
      makeMessage('message-1', '2026-08-26T10:00:00.000Z'),
    ]);
    prisma.message.count.mockResolvedValue(0);

    await expect(
      service.getMessages('user-1', 'conversation-1', { limit: 2, beforeId: 'cursor-3' }),
    ).resolves.toMatchObject({
      items: [{ id: 'message-1' }, { id: 'message-2' }],
      hasMore: true,
      nextCursor: 'message-1',
    });
  });
});
