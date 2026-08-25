import { NotFoundException } from '@nestjs/common';
import { ChildProfilesService } from './child-profiles.service';

describe('ChildProfilesService', () => {
  const membership = { requirePartner: jest.fn() };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };

  beforeEach(() => jest.clearAllMocks());

  function createService(overrides: Record<string, unknown> = {}) {
    const tx = {
      childProfile: {
        create: jest.fn().mockResolvedValue({ id: 'child-id' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'child-id', version: 2 }),
      },
    };
    const prisma = {
      childProfile: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue({ id: 'child-id', version: 1 }),
      },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
      ...overrides,
    };
    return {
      service: new ChildProfilesService(prisma as never, membership as never, audit as never),
      prisma,
      tx,
    };
  }

  it('creates a profile and audit event atomically in the partner family', async () => {
    membership.requirePartner.mockResolvedValue({ familyId: 'family-id' });
    const { service, tx } = createService();

    await service.create('partner-id', { firstName: 'Anna', birthDate: '2020-01-02' });

    expect(tx.childProfile.create).toHaveBeenCalledWith({
      data: {
        familyId: 'family-id',
        firstName: 'Anna',
        lastName: null,
        birthDate: new Date('2020-01-02'),
        avatarUrl: null,
      },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'child_profile.created', resourceId: 'child-id' }),
      tx,
    );
  });

  it('lists only active profiles and exposes archived profiles separately', async () => {
    membership.requirePartner.mockResolvedValue({ familyId: 'family-id' });
    const { service, prisma } = createService();

    await service.list('partner-id');
    await service.listArchived('partner-id');

    expect(prisma.childProfile.findMany).toHaveBeenNthCalledWith(1, {
      where: { familyId: 'family-id', archived: false },
      orderBy: [{ firstName: 'asc' }, { createdAt: 'asc' }],
    });
    expect(prisma.childProfile.findMany).toHaveBeenNthCalledWith(2, {
      where: { familyId: 'family-id', archived: true },
      orderBy: { updatedAt: 'desc' },
    });
  });

  it('archives a profile without deleting its child-scoped history', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-25T12:00:00.000Z'));
    membership.requirePartner.mockResolvedValue({ familyId: 'family-id' });
    const { service, tx } = createService();

    await service.archive('partner-id', 'child-id', 1);

    expect(tx.childProfile.updateMany).toHaveBeenCalledWith({
      where: { id: 'child-id', familyId: 'family-id', archived: false, version: 1 },
      data: {
        archived: true,
        archivedAt: new Date('2026-08-25T12:00:00.000Z'),
        version: { increment: 1 },
      },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'child_profile.archived' }),
      tx,
    );
    jest.useRealTimers();
  });

  it('restores an archived profile only with the current version', async () => {
    membership.requirePartner.mockResolvedValue({ familyId: 'family-id' });
    const { service, prisma, tx } = createService();
    prisma.childProfile.findFirst.mockResolvedValue({ id: 'child-id', version: 2, archived: true });

    await service.restore('partner-id', 'child-id', 2);

    expect(tx.childProfile.updateMany).toHaveBeenCalledWith({
      where: { id: 'child-id', familyId: 'family-id', archived: true, version: 2 },
      data: { archived: false, archivedAt: null, version: { increment: 1 } },
    });
  });

  it('does not reveal a profile outside the current family', async () => {
    membership.requirePartner.mockResolvedValue({ familyId: 'family-id' });
    const { service, prisma } = createService();
    prisma.childProfile.findFirst.mockResolvedValue(null);

    await expect(service.archive('partner-id', 'other-child-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
