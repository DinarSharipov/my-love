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
  };
  const membership = { requirePartner: jest.fn(), requireMembership: jest.fn() };
  const service = new ChildProfilesService(prisma as never, membership as never);

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
      profile: { id: 'child-id', firstName: 'Anna' },
      tasks: [{ id: 'task-id' }],
      events: [{ id: 'event-id' }],
    });
    expect(prisma.childProfile.findFirst).toHaveBeenCalledWith({
      where: { id: 'child-id', familyId: 'family-id' },
      include: {
        tasks: { orderBy: [{ createdAt: 'asc' }] },
        events: { where: { deletedAt: null }, orderBy: [{ scheduledAt: 'asc' }] },
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
});
