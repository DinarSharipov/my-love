import { BadRequestException } from '@nestjs/common';
import { CalendarService } from './calendar.service';

describe('CalendarService', () => {
  it('rejects reversed and excessively wide ranges before querying membership', async () => {
    const membership = { requireMembership: jest.fn() };
    const service = new CalendarService({} as never, membership as never);

    await expect(
      service.project('user-id', { dateFrom: '2026-09-01', dateTo: '2026-08-01' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.project('user-id', { dateFrom: '2026-01-01', dateTo: '2026-06-01' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(membership.requireMembership).not.toHaveBeenCalled();
  });

  it('combines family events/tasks with only the current users reminders', async () => {
    const event = {
      id: 'event-id',
      name: 'Event',
      scheduledAt: new Date('2026-08-16T12:00:00.000Z'),
      status: 'CONFIRMED',
    };
    const task = {
      id: 'task-id',
      title: 'Task',
      dueAt: new Date('2026-08-16T10:00:00.000Z'),
      status: 'OPEN',
      assignedToId: null,
    };
    const reminder = {
      id: 'reminder-id',
      remindAt: new Date('2026-08-16T09:00:00.000Z'),
      sentAt: null,
      task: { title: 'Task reminder' },
    };
    const prisma = {
      familyEvent: { findMany: jest.fn().mockReturnValue({}) },
      task: { findMany: jest.fn().mockReturnValue({}) },
      taskReminder: { findMany: jest.fn().mockReturnValue({}) },
      $transaction: jest.fn().mockResolvedValue([[event], [task], [reminder]]),
    };
    const membership = {
      requireMembership: jest.fn().mockResolvedValue({
        familyId: 'family-id',
        timeZone: 'Europe/Moscow',
      }),
    };
    const service = new CalendarService(prisma as never, membership as never);

    const result = await service.project('user-id', {
      dateFrom: '2026-08-16',
      dateTo: '2026-08-17',
    });

    expect(result.data.map((entry) => entry.id)).toEqual([
      'task-reminder:reminder-id',
      'task:task-id',
      'event:event-id',
    ]);
    expect(result).toMatchObject({
      dateFrom: '2026-08-16',
      dateTo: '2026-08-17',
      timeZone: 'Europe/Moscow',
      truncated: false,
    });
    expect(prisma.taskReminder.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-id',
        remindAt: {
          gte: new Date('2026-08-15T21:00:00.000Z'),
          lt: new Date('2026-08-16T21:00:00.000Z'),
        },
        task: { familyId: 'family-id', status: { not: 'ARCHIVED' } },
      },
      select: {
        id: true,
        remindAt: true,
        sentAt: true,
        task: { select: { title: true } },
      },
      orderBy: [{ remindAt: 'asc' }, { id: 'asc' }],
      take: 501,
    });
  });
});
