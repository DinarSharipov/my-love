import { IntimacyMood, IntimacyPreference, IntimacyRating } from '@prisma/client';
import { validate } from 'class-validator';
import { UpsertIntimacyEventDto } from './dto/intimacy.dto';
import { IntimacyService } from './intimacy.service';

describe('UpsertIntimacyEventDto', () => {
  it('accepts the occurred field with strict whitelist validation', async () => {
    const dto = Object.assign(new UpsertIntimacyEventDto(), {
      occurred: true,
      rating: IntimacyRating.GOOD,
    });

    await expect(validate(dto, { whitelist: true, forbidNonWhitelisted: true })).resolves.toEqual(
      [],
    );
  });
});

describe('IntimacyService', () => {
  const membership = { requirePartner: jest.fn() };
  const prisma = {
    familyMember: { findFirst: jest.fn() },
    intimacyCheckIn: { findMany: jest.fn(), findFirst: jest.fn() },
    intimacyEvent: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const tx = {
    intimacyCheckIn: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    intimacyCheckInPreference: { deleteMany: jest.fn(), createMany: jest.fn() },
  };
  const service = new IntimacyService(prisma as never, membership as never);

  beforeEach(() => {
    jest.clearAllMocks();
    membership.requirePartner.mockResolvedValue({ familyId: 'family-1' });
    prisma.familyMember.findFirst.mockResolvedValue({ userId: 'user-2' });
    prisma.$transaction.mockImplementation((callback: (value: typeof tx) => unknown) =>
      callback(tx),
    );
  });

  it('requires a partner membership before accessing data', async () => {
    membership.requirePartner.mockRejectedValue(new Error('forbidden'));
    await expect(service.getCheckIn('user-1', '2026-08-28')).rejects.toThrow('forbidden');
    expect(prisma.familyMember.findFirst).not.toHaveBeenCalled();
  });

  it('returns only partner answered flag until both partners answer', async () => {
    prisma.intimacyCheckIn.findMany.mockResolvedValue([
      {
        userId: 'user-2',
        familyId: 'family-1',
        date: new Date('2026-08-28T00:00:00Z'),
        mood: IntimacyMood.SEX,
        desireLevel: 5,
        preferences: [{ preference: IntimacyPreference.SEX }],
      },
    ]);
    await expect(service.getCheckIn('user-1', '2026-08-28')).resolves.toEqual({
      date: '2026-08-28',
      myCheckIn: null,
      partnerHasAnswered: true,
      aggregate: null,
    });
  });

  it('computes only safe aggregate after both answers', async () => {
    prisma.intimacyCheckIn.findMany.mockResolvedValue([
      {
        userId: 'user-1',
        date: new Date('2026-08-28T00:00:00Z'),
        mood: IntimacyMood.SEX,
        desireLevel: 4,
        preferences: [
          { preference: IntimacyPreference.SEX },
          { preference: IntimacyPreference.KISSING },
        ],
      },
      {
        userId: 'user-2',
        date: new Date('2026-08-28T00:00:00Z'),
        mood: IntimacyMood.CLOSENESS,
        desireLevel: 3,
        preferences: [{ preference: IntimacyPreference.SEX }],
      },
    ]);
    const result = await service.getCheckIn('user-1', '2026-08-28');
    expect(result.aggregate).toEqual({
      hasMutualInterest: true,
      matchedPreferences: [IntimacyPreference.SEX],
    });
    expect(result).not.toHaveProperty('partnerCheckIn');
  });

  it('scopes calendar reads to the active family and both adults', async () => {
    prisma.intimacyCheckIn.findMany.mockResolvedValue([]);
    prisma.intimacyEvent.findMany.mockResolvedValue([]);
    await service.calendar('user-1', '2026-08-28', '2026-08-28');
    expect(prisma.intimacyCheckIn.findMany).toHaveBeenCalled();
    expect(prisma.intimacyEvent.findMany).toHaveBeenCalled();
  });
});
