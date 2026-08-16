import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import {
  FamilyEvent,
  FamilyEventDecisionStatus,
  FamilyMemberRole,
  Gender,
  Prisma,
  User,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { FamilyMembershipService } from '../family-members/family-membership.service';
import { FamilyEventsService } from './family-events.service';

describe('FamilyEventsService', () => {
  const notifications = {
    notifyFamilyMembers: jest.fn().mockResolvedValue(undefined),
    notifyUser: jest.fn().mockResolvedValue(undefined),
  };
  const creatorId = '2aa49af8-40fc-4f36-bb9d-246febd3dbe9';
  const partnerId = '76c40452-1f1d-4181-a15a-ec7ae187fbe4';
  const familyId = '4628fd76-11ad-41b3-a5de-6561cbc030d6';
  const eventId = '34d97b27-78f3-4d5f-baa8-e101ed162230';
  const membership = {
    requirePartner: jest.fn().mockResolvedValue({ familyId, timeZone: 'Europe/Moscow' }),
  } as unknown as FamilyMembershipService;
  const creator: User = {
    id: creatorId,
    firstName: 'Иван',
    lastName: 'Иванов',
    email: 'ivan@example.com',
    passwordHash: null,
    gender: Gender.MALE,
    description: null,
    birthDate: new Date('1995-05-20'),
    phone: null,
    locale: 'ru-RU',
    timeZone: 'Europe/Moscow',
    version: 1,
    isActive: true,
    deletionRequestedAt: null,
    deletionScheduledAt: null,
    retentionAnonymizedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  const event: FamilyEvent = {
    id: eventId,
    familyId,
    proposedById: creatorId,
    respondedById: partnerId,
    deletedById: null,
    name: 'Ужин',
    description: 'В центре',
    scheduledAt: new Date('2099-09-20T16:00:00.000Z'),
    location: 'Москва',
    reminderOffsetMinutes: null,
    reminderRecipientIds: [],
    reminderAt: null,
    reminderSentAt: null,
    repeatReminderAt: null,
    repeatReminderSentAt: null,
    status: FamilyEventDecisionStatus.CONFIRMED,
    respondedAt: new Date('2026-08-15T10:00:00.000Z'),
    deletedAt: null,
    version: 1,
    createdAt: new Date('2026-08-15T09:00:00.000Z'),
    updatedAt: new Date('2026-08-15T10:00:00.000Z'),
  };

  it('requires exactly two partners when creating an event', async () => {
    const count = jest.fn().mockResolvedValue(1);
    const prisma = { familyMember: { count } };
    const service = new FamilyEventsService(
      prisma as unknown as PrismaService,
      membership,
      notifications as never,
    );

    await expect(
      service.create(creatorId, {
        name: 'Ужин',
        scheduledAt: '2099-09-20T16:00:00.000Z',
        location: 'Москва',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(count).toHaveBeenCalledWith({
      where: { familyId, role: FamilyMemberRole.PARTNER },
    });
  });

  it('stores validated first and repeat reminders for family members', async () => {
    const scheduledAt = '2099-09-20T16:00:00.000Z';
    const create = jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({
      ...event,
      scheduledAt: new Date(scheduledAt),
      reminderOffsetMinutes: 60,
      reminderRecipientIds: [creatorId, partnerId],
      reminderAt: new Date('2099-09-20T15:00:00.000Z'),
      repeatReminderAt: new Date('2099-09-20T15:30:00.000Z'),
      proposedBy: creator,
      respondedBy: null,
    });
    const prisma = {
      familyMember: {
        count: jest.fn().mockResolvedValue(2),
        findMany: jest.fn().mockResolvedValue([{ userId: creatorId }, { userId: partnerId }]),
      },
      familyEvent: { create },
    };
    const service = new FamilyEventsService(
      prisma as unknown as PrismaService,
      membership,
      notifications as never,
    );

    await service.create(creatorId, {
      name: 'Ужин',
      scheduledAt,
      location: 'Москва',
      reminderOffsetMinutes: 60,
      reminderRecipientIds: [creatorId, partnerId],
      repeatReminderAt: '2099-09-20T15:30:00.000Z',
    });

    const createArg = create.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(createArg.data).toEqual(
      expect.objectContaining({
        reminderOffsetMinutes: 60,
        reminderRecipientIds: [creatorId, partnerId],
        reminderAt: new Date('2099-09-20T15:00:00.000Z'),
        repeatReminderAt: new Date('2099-09-20T15:30:00.000Z'),
      }),
    );
  });

  it('rejects reminder recipients outside the family', async () => {
    const prisma = {
      familyMember: {
        count: jest.fn().mockResolvedValue(2),
        findMany: jest.fn().mockResolvedValue([{ userId: creatorId }]),
      },
    };
    const service = new FamilyEventsService(
      prisma as unknown as PrismaService,
      membership,
      notifications as never,
    );

    await expect(
      service.create(creatorId, {
        name: 'Ужин',
        scheduledAt: '2099-09-20T16:00:00.000Z',
        location: 'Москва',
        reminderOffsetMinutes: 60,
        reminderRecipientIds: [creatorId, partnerId],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lets the creator update and re-propose an answered event', async () => {
    const findFirstOrThrow = jest.fn((args: Prisma.FamilyEventFindFirstOrThrowArgs) => {
      void args;
      return Promise.resolve({
        ...event,
        name: 'Новый ужин',
        version: 2,
        status: FamilyEventDecisionStatus.PROPOSED,
        respondedById: null,
        respondedAt: null,
        proposedBy: creator,
        respondedBy: null,
      });
    });
    const updateMany = jest.fn((args: Prisma.FamilyEventUpdateManyArgs) => {
      void args;
      return Promise.resolve({ count: 1 });
    });
    const transaction = {
      familyEvent: {
        findFirst: jest.fn().mockResolvedValue(event),
        updateMany,
        findFirstOrThrow,
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    };
    const service = new FamilyEventsService(
      prisma as unknown as PrismaService,
      membership,
      notifications as never,
    );

    const result = await service.update(eventId, creatorId, { name: 'Новый ужин' }, 1);

    expect(result.status).toBe('PROPOSED');
    expect(result.version).toBe(2);
    const updateArgs = updateMany.mock.calls[0][0];
    expect(updateArgs.where).toEqual(
      expect.objectContaining({ id: eventId, familyId, version: 1 }),
    );
    expect(updateArgs.data).toEqual(
      expect.objectContaining({
        name: 'Новый ужин',
        respondedAt: null,
        respondedById: null,
        status: FamilyEventDecisionStatus.PROPOSED,
      }),
    );
  });

  it('does not let the partner update another creator event', async () => {
    const transaction = {
      familyEvent: {
        findFirst: jest.fn().mockResolvedValue(event),
        updateMany: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    };
    const service = new FamilyEventsService(
      prisma as unknown as PrismaService,
      membership,
      notifications as never,
    );

    await expect(service.update(eventId, partnerId, { name: 'Подмена' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(transaction.familyEvent.updateMany).not.toHaveBeenCalled();
  });

  it('rejects an empty update', async () => {
    const service = new FamilyEventsService(
      {} as PrismaService,
      membership,
      notifications as never,
    );

    await expect(service.update(eventId, creatorId, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
