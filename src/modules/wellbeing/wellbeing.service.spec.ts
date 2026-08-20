import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WellbeingService } from './wellbeing.service';

describe('WellbeingService', () => {
  const membership = {
    requireMembership: jest.fn(),
  };
  const prisma = {
    wellbeingCheckIn: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    wellbeingAssessment: {
      create: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    wellbeingConsentGrant: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    wellbeingGratitude: {
      create: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    wellbeingSupportRequest: {
      create: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      deleteMany: jest.fn(),
    },
    wellbeingRitual: {
      create: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      deleteMany: jest.fn(),
    },
    wellbeingCoupleMeeting: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    familyMember: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  };
  const notifications = { notifyUser: jest.fn().mockResolvedValue(undefined) };
  const service = new WellbeingService(
    prisma as never,
    membership as never,
    notifications as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('creates a check-in in the authenticated user family', async () => {
    membership.requireMembership.mockResolvedValue({ familyId: 'family-id' });
    prisma.wellbeingCheckIn.create.mockResolvedValue({ id: 'check-in-id' });

    await service.create('user-id', {
      mood: 4,
      energy: 3,
      stress: 2,
      note: 'A little tired',
      supportRequest: true,
    });

    expect(prisma.wellbeingCheckIn.create).toHaveBeenCalledWith({
      data: {
        familyId: 'family-id',
        ownerId: 'user-id',
        mood: 4,
        energy: 3,
        stress: 2,
        note: 'A little tired',
        supportRequest: true,
      },
    });
  });

  it('does not expose a check-in owned by another user', async () => {
    membership.requireMembership.mockResolvedValue({ familyId: 'family-id' });
    prisma.wellbeingCheckIn.findFirst.mockResolvedValue(null);

    await expect(service.findOne('user-id', 'foreign-check-in')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.wellbeingCheckIn.findFirst).toHaveBeenCalledWith({
      where: { id: 'foreign-check-in', ownerId: 'user-id' },
    });
  });

  it('requires family membership before listing private check-ins', async () => {
    membership.requireMembership.mockRejectedValue(new Error('membership required'));

    await expect(service.list('user-id')).rejects.toThrow('membership required');
    expect(prisma.wellbeingCheckIn.findMany).not.toHaveBeenCalled();
  });

  it('shares wellbeing data only from active owners in the active family', async () => {
    membership.requireMembership.mockResolvedValue({ familyId: 'family-id' });
    prisma.wellbeingConsentGrant.findMany.mockResolvedValue([]);

    await service.sharedWithMe('partner-id');

    expect(prisma.wellbeingConsentGrant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        where: expect.objectContaining({
          family: { status: 'ACTIVE' },
          owner: { isActive: true, familyMember: { familyId: 'family-id' } },
        }),
      }),
    );
  });

  it('rejects an already expired wellbeing consent', async () => {
    membership.requireMembership.mockResolvedValue({ familyId: 'family-id' });

    await expect(
      service.grantConsent('user-id', {
        recipientId: 'partner-id',
        scopes: ['mood'],
        expiresAt: '2020-01-01T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.familyMember.findFirst).not.toHaveBeenCalled();
    expect(prisma.wellbeingConsentGrant.upsert).not.toHaveBeenCalled();
  });

  it('stores a transparent WHO-5 score and keeps assessment owner-scoped', async () => {
    membership.requireMembership.mockResolvedValue({ familyId: 'family-id' });
    prisma.wellbeingAssessment.create.mockResolvedValue({ id: 'assessment-id', score: 18 });

    await service.createAssessment('user-id', { answers: [4, 3, 5, 2, 4] });

    expect(prisma.wellbeingAssessment.create).toHaveBeenCalledWith({
      data: { familyId: 'family-id', ownerId: 'user-id', answers: [4, 3, 5, 2, 4], score: 18 },
    });
  });

  it('deletes all wellbeing data and consent grants for the owner', async () => {
    membership.requireMembership.mockResolvedValue({ familyId: 'family-id' });
    prisma.$transaction.mockResolvedValue([]);

    await service.deleteAll('user-id');

    expect(prisma.$transaction).toHaveBeenCalledWith([
      prisma.wellbeingConsentGrant.deleteMany({
        where: { OR: [{ ownerId: 'user-id' }, { recipientId: 'user-id' }] },
      }),
      prisma.wellbeingAssessment.deleteMany({ where: { ownerId: 'user-id' } }),
      prisma.wellbeingCheckIn.deleteMany({ where: { ownerId: 'user-id' } }),
      prisma.wellbeingGratitude.deleteMany({
        where: { OR: [{ authorId: 'user-id' }, { recipientId: 'user-id' }] },
      }),
      prisma.wellbeingSupportRequest.deleteMany({
        where: { OR: [{ requesterId: 'user-id' }, { recipientId: 'user-id' }] },
      }),
      prisma.wellbeingRitual.deleteMany({ where: { createdById: 'user-id' } }),
      prisma.wellbeingCoupleMeeting.deleteMany({ where: { createdById: 'user-id' } }),
    ]);
  });

  it('exports every wellbeing record within the authenticated user scope', async () => {
    membership.requireMembership.mockResolvedValue({ familyId: 'family-id' });
    prisma.wellbeingCheckIn.findMany.mockResolvedValue(['check-in']);
    prisma.wellbeingAssessment.findMany.mockResolvedValue(['assessment']);
    prisma.wellbeingGratitude.findMany.mockResolvedValue(['gratitude']);
    prisma.wellbeingSupportRequest.findMany.mockResolvedValue(['support-request']);
    prisma.wellbeingRitual.findMany.mockResolvedValue(['ritual']);
    prisma.wellbeingCoupleMeeting.findMany.mockResolvedValue(['meeting']);

    await expect(service.exportData('user-id')).resolves.toEqual({
      checkIns: ['check-in'],
      assessments: ['assessment'],
      gratitudes: ['gratitude'],
      supportRequests: ['support-request'],
      rituals: ['ritual'],
      coupleMeetings: ['meeting'],
    });
  });

  it('creates partner gratitude and sends a neutral notification', async () => {
    membership.requireMembership.mockResolvedValue({ familyId: 'family-id' });
    prisma.familyMember.findFirst.mockResolvedValue({ userId: 'partner-id' });
    prisma.wellbeingGratitude.create.mockResolvedValue({ id: 'gratitude-id' });

    await service.createGratitude('user-id', { recipientId: 'partner-id', message: 'Thank you' });

    expect(prisma.wellbeingGratitude.create).toHaveBeenCalledWith({
      data: {
        familyId: 'family-id',
        authorId: 'user-id',
        recipientId: 'partner-id',
        message: 'Thank you',
      },
    });
    expect(notifications.notifyUser).toHaveBeenCalledWith({
      userId: 'partner-id',
      familyId: 'family-id',
      type: 'WELLBEING_GRATITUDE_RECEIVED',
      title: 'New gratitude',
      body: 'Your partner sent you a gratitude message.',
    });
  });
});
