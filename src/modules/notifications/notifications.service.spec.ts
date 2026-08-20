import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  const membership = {
    requireMembership: jest.fn().mockResolvedValue({ familyId: 'family-id' }),
  };

  it('scopes inbox reads to the authenticated user and current family', async () => {
    const prisma = { notification: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new NotificationsService(prisma as never, membership as never);

    await service.list('user-id');

    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-id',
        OR: [{ familyId: 'family-id' }, { familyId: null }],
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  });

  it('does not reveal or modify another users notification', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-16T10:00:00.000Z'));
    const prisma = {
      notification: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    const service = new NotificationsService(prisma as never, membership as never);

    await expect(service.markRead('user-id', 'foreign-notification-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: 'foreign-notification-id', userId: 'user-id', readAt: null },
      data: { readAt: new Date('2026-08-16T10:00:00.000Z') },
    });
    jest.useRealTimers();
  });

  it('returns a stable paginated inbox without changing the legacy list contract', async () => {
    const rows = [
      {
        id: 'notification-id',
        userId: 'user-id',
        familyId: 'family-id',
        type: 'TASK',
        title: 'Task',
        body: null,
        readAt: null,
        createdAt: new Date('2026-08-16T10:00:00.000Z'),
      },
    ];
    const prisma = {
      notification: {
        count: jest.fn().mockReturnValue({}),
        findMany: jest.fn().mockReturnValue({}),
      },
      $transaction: jest.fn().mockResolvedValue([1, rows]),
    };
    const service = new NotificationsService(prisma as never, membership as never);

    await expect(service.listPaginated('user-id', { page: 2, limit: 10 })).resolves.toEqual({
      data: rows,
      total: 1,
      page: 2,
      limit: 10,
      totalPages: 1,
    });
    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-id',
        OR: [{ familyId: 'family-id' }, { familyId: null }],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: 10,
      take: 10,
    });
  });
});
