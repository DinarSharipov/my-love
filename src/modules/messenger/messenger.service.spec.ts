import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConversationType, MessageType } from '@prisma/client';
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
    message: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    media: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const mediaService = { findManyByIds: jest.fn() };
  const service = new MessengerService(prisma as never, membership as never, mediaService as never);

  beforeEach(() => {
    jest.clearAllMocks();
    membership.requireMembership.mockResolvedValue({ familyId: 'family-1' });
  });

  it('rejects a direct conversation with more than one other member', async () => {
    await expect(
      service.createConversation('user-1', {
        type: ConversationType.DIRECT,
        memberIds: ['user-2', 'user-3'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
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
    const existing = { id: 'message-1', clientMessageId: 'client-1' };
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
    ).resolves.toBe(existing);
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
});
