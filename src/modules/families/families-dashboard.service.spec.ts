import { FamiliesService } from './families.service';

describe('FamiliesService dashboard', () => {
  afterEach(() => jest.useRealTimers());

  it('scopes every aggregate to the current family and notification owner', async () => {
    const now = new Date('2026-08-16T10:00:00.000Z');
    jest.useFakeTimers().setSystemTime(now);
    const prisma = {
      task: { count: jest.fn().mockReturnValueOnce({}).mockReturnValueOnce({}) },
      shoppingItem: { count: jest.fn().mockReturnValue({}) },
      notification: { count: jest.fn().mockReturnValue({}) },
      familyEvent: {
        count: jest.fn().mockReturnValue({}),
        findMany: jest.fn().mockReturnValue({}),
      },
      $transaction: jest.fn().mockResolvedValue([3, 1, 4, 2, 6, []]),
    };
    const membership = {
      requireMembership: jest.fn().mockResolvedValue({ familyId: 'family-id' }),
    };
    const service = new FamiliesService(
      prisma as never,
      membership as never,
      {} as never,
      {} as never,
    );

    await expect(service.dashboard('user-id')).resolves.toEqual({
      openTasks: 3,
      overdueTasks: 1,
      uncheckedShoppingItems: 4,
      unreadNotifications: 2,
      upcomingEvents: 6,
      nextEvents: [],
      generatedAt: now,
    });
    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: {
        userId: 'user-id',
        readAt: null,
        OR: [{ familyId: 'family-id' }, { familyId: null }],
      },
    });
    expect(prisma.familyEvent.findMany).toHaveBeenCalledWith({
      where: { familyId: 'family-id', deletedAt: null, scheduledAt: { gte: now } },
      select: { id: true, name: true, scheduledAt: true },
      orderBy: { scheduledAt: 'asc' },
      take: 5,
    });
  });
});
