import { TaskPriority, TaskRoutineFrequency } from '@prisma/client';
import { TaskRoutinesService } from './task-routines.service';

describe('TaskRoutinesService scheduled generation', () => {
  const routine = {
    id: 'routine-id',
    familyId: 'family-id',
    createdById: 'creator-id',
    assignedToId: null,
    title: 'Weekly task',
    description: null,
    priority: TaskPriority.NORMAL,
    frequency: TaskRoutineFrequency.WEEKLY,
    interval: 1,
    nextRunAt: new Date('2026-08-16T08:00:00.000Z'),
    active: true,
    version: 3,
    createdAt: new Date('2026-08-01T08:00:00.000Z'),
    updatedAt: new Date('2026-08-01T08:00:00.000Z'),
  };

  it('atomically advances and creates one task for a due routine', async () => {
    const tx = {
      taskRoutine: {
        findFirst: jest.fn().mockResolvedValue(routine),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      task: { create: jest.fn().mockResolvedValue({ id: 'task-id' }) },
    };
    const prisma = {
      taskRoutine: { findMany: jest.fn().mockResolvedValue([routine]) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const notifications = { notifyFamilyMembers: jest.fn().mockResolvedValue(undefined) };
    const service = new TaskRoutinesService(
      prisma as never,
      {} as never,
      audit as never,
      notifications as never,
    );

    await expect(service.generateDue(new Date('2026-08-16T09:00:00.000Z'))).resolves.toEqual({
      generated: 1,
    });
    expect(tx.taskRoutine.updateMany).toHaveBeenCalledWith({
      where: { id: 'routine-id', active: true, version: 3 },
      data: {
        nextRunAt: new Date('2026-08-23T08:00:00.000Z'),
        version: { increment: 1 },
      },
    });
    expect(tx.task.create).toHaveBeenCalledWith({
      data: {
        familyId: 'family-id',
        createdById: 'creator-id',
        assignedToId: null,
        title: 'Weekly task',
        description: null,
        priority: TaskPriority.NORMAL,
        dueAt: routine.nextRunAt,
      },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { routineId: 'routine-id', scheduled: true } }),
      tx,
    );
  });

  it('does not create a duplicate when another worker already claimed the routine', async () => {
    const tx = {
      taskRoutine: {
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn(),
      },
      task: { create: jest.fn() },
    };
    const prisma = {
      taskRoutine: { findMany: jest.fn().mockResolvedValue([routine]) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new TaskRoutinesService(
      prisma as never,
      {} as never,
      {} as never,
      {
        notifyFamilyMembers: jest.fn(),
      } as never,
    );

    await expect(service.generateDue()).resolves.toEqual({ generated: 0 });
    expect(tx.task.create).not.toHaveBeenCalled();
  });
});
