import { NotFoundException } from '@nestjs/common';
import { ChildProfilesService } from './child-profiles.service';

describe('ChildProfilesService', () => {
  const prisma = {
    childProfile: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    media: { findFirst: jest.fn() },
  };
  const membership = { requirePartner: jest.fn(), requireMembership: jest.fn() };
  const storage = { getObjectStream: jest.fn() };
  const service = new ChildProfilesService(prisma as never, membership as never, storage as never);

  beforeEach(() => jest.clearAllMocks());

  it('creates a profile in the partner family', async () => {
    membership.requirePartner.mockResolvedValue({ familyId: 'family-id' });
    prisma.childProfile.create.mockResolvedValue({ id: 'child-id' });

    await service.create('partner-id', { firstName: 'Anna', birthDate: '2020-01-02' });

    expect(prisma.childProfile.create).toHaveBeenCalledWith({
      data: {
        familyId: 'family-id',
        firstName: 'Anna',
        lastName: null,
        birthDate: new Date('2020-01-02'),
        avatarUrl: null,
        avatarMediaId: undefined,
        avatarPreviewToken: null,
      },
    });
  });

  it('lists profiles for any active family member', async () => {
    membership.requireMembership.mockResolvedValue({ familyId: 'family-id' });
    prisma.childProfile.findMany.mockResolvedValue([]);

    await service.list('child-user-id');

    expect(prisma.childProfile.findMany).toHaveBeenCalledWith({
      where: { familyId: 'family-id' },
      orderBy: [{ firstName: 'asc' }, { createdAt: 'asc' }],
    });
  });

  it('does not update a profile from another family', async () => {
    membership.requirePartner.mockResolvedValue({ familyId: 'family-id' });
    prisma.childProfile.findFirst.mockResolvedValue(null);

    await expect(
      service.update('partner-id', 'other-child-id', { firstName: 'Nope' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.childProfile.update).not.toHaveBeenCalled();
  });

  it('exports only the child profile and active child-scoped records', async () => {
    membership.requireMembership.mockResolvedValue({ familyId: 'family-id' });
    prisma.childProfile.findFirst.mockResolvedValue({
      id: 'child-id',
      firstName: 'Anna',
      tasks: [{ id: 'task-id' }],
      events: [{ id: 'event-id' }],
    });

    await expect(service.export('member-id', 'child-id')).resolves.toEqual({
      profile: {
        id: 'child-id',
        firstName: 'Anna',
        avatarMediaId: undefined,
        avatarUrl: undefined,
      },
      tasks: [{ id: 'task-id' }],
      events: [{ id: 'event-id' }],
    });
    expect(prisma.childProfile.findFirst).toHaveBeenCalledWith({
      where: { id: 'child-id', familyId: 'family-id' },
      select: {
        id: true,
        familyId: true,
        firstName: true,
        lastName: true,
        birthDate: true,
        avatarUrl: true,
        avatarMediaId: true,
        avatarPreviewToken: true,
        createdAt: true,
        updatedAt: true,
        tasks: {
          orderBy: [{ createdAt: 'asc' }],
          select: {
            id: true,
            title: true,
            description: true,
            dueAt: true,
            priority: true,
            status: true,
            version: true,
            completedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        events: {
          where: { deletedAt: null },
          orderBy: [{ scheduledAt: 'asc' }],
          select: {
            id: true,
            name: true,
            description: true,
            scheduledAt: true,
            location: true,
            status: true,
            respondedAt: true,
            version: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
  });

  it('removes only a profile in the current family', async () => {
    membership.requirePartner.mockResolvedValue({ familyId: 'family-id' });
    prisma.childProfile.deleteMany.mockResolvedValue({ count: 1 });

    await service.remove('partner-id', 'child-id');

    expect(prisma.childProfile.deleteMany).toHaveBeenCalledWith({
      where: { id: 'child-id', familyId: 'family-id' },
    });
  });

  it('allows a partner to attach only a family image with a preview', async () => {
    membership.requirePartner.mockResolvedValue({ familyId: 'family-id' });
    prisma.media.findFirst.mockResolvedValue({ id: 'media-id' });
    prisma.childProfile.create.mockResolvedValue({
      id: 'child-id',
      avatarUrl: null,
      avatarMediaId: 'media-id',
      avatarPreviewToken: 'preview-token',
    });

    const result = await service.create('partner-id', {
      firstName: 'Anna',
      birthDate: '2020-01-02',
      avatarMediaId: 'media-id',
    });

    expect(result.avatarMediaId).toBe('media-id');
    expect(result.avatarUrl).toContain('/children/child-id/avatar?token=');

    expect(prisma.media.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'media-id',
        familyId: 'family-id',
        kind: 'IMAGE',
        previewObjectKey: { not: null },
      },
      select: { id: true },
    });
  });

  it('streams only the image preview identified by the capability token', async () => {
    prisma.childProfile.findFirst.mockResolvedValue({
      avatarMedia: { previewObjectKey: 'previews/family-id/media-id.webp' },
    });
    storage.getObjectStream.mockResolvedValue({ body: {}, contentLength: 1 });

    await service.streamAvatar('child-id', 'preview-token', 'bytes=0-1');

    expect(storage.getObjectStream).toHaveBeenCalledWith(
      'previews/family-id/media-id.webp',
      'bytes=0-1',
    );
  });
});
