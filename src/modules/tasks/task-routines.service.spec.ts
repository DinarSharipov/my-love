import { TaskPriority, TaskRoutineFrequency } from '@prisma/client';
import { TaskRoutinesService } from './task-routines.service';

describe('TaskRoutinesService scheduled generation', () => {
  const routine = {
    id: 'routine-id',
    familyId: 'family-id',
    createdById: 'creator-id',
    assignedToId: null,
    childId: 'child-id',
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
        childId: 'child-id',
        title: 'Weekly task',
        description: null,
        priority: TaskPriority.NORMAL,
        dueAt: new Date('2026-08-16T09:00:00.000Z'),
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

  it('creates one current task and skips historical occurrences', async () => {
    const overdueRoutine = { ...routine, nextRunAt: new Date('2026-07-19T08:00:00.000Z') };
    const tx = {
      taskRoutine: {
        findFirst: jest.fn().mockResolvedValue(overdueRoutine),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      task: { create: jest.fn().mockResolvedValue({ id: 'task-id' }) },
    };
    const prisma = {
      taskRoutine: { findMany: jest.fn().mockResolvedValue([overdueRoutine]) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new TaskRoutinesService(
      prisma as never,
      {} as never,
      { record: jest.fn().mockResolvedValue(undefined) } as never,
      { notifyFamilyMembers: jest.fn().mockResolvedValue(undefined) } as never,
    );
    const now = new Date('2026-08-20T09:00:00.000Z');

    await expect(service.generateDue(now)).resolves.toEqual({ generated: 1 });
    expect(tx.taskRoutine.updateMany).toHaveBeenCalledWith({
      where: { id: overdueRoutine.id, active: true, version: overdueRoutine.version },
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
        childId: 'child-id',
        title: 'Weekly task',
        description: null,
        priority: TaskPriority.NORMAL,
        dueAt: now,
      },
    });
  });

  it('updates an active routine within the caller family and increments its version', async () => {
    const updatedRoutine = { ...routine, title: 'Updated task', version: 4 };
    const prisma = {
      taskRoutine: {
        findFirst: jest.fn().mockResolvedValue(routine),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(updatedRoutine),
      },
      familyMember: { findFirst: jest.fn().mockResolvedValue({ id: 'member-id' }) },
      childProfile: { findFirst: jest.fn().mockResolvedValue({ id: 'child-id' }) },
    };
    const membership = {
      requireMembership: jest.fn().mockResolvedValue({ familyId: 'family-id' }),
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const notifications = { notifyFamilyMembers: jest.fn().mockResolvedValue(undefined) };
    const service = new TaskRoutinesService(
      prisma as never,
      membership as never,
      audit as never,
      notifications as never,
    );

    await expect(
      service.update('routine-id', 'user-id', { title: 'Updated task', childId: 'child-id' }, 3),
    ).resolves.toEqual(updatedRoutine);
    expect(prisma.taskRoutine.updateMany).toHaveBeenCalledWith({
      where: { id: 'routine-id', familyId: 'family-id', active: true, version: 3 },
      data: {
        title: 'Updated task',
        description: undefined,
        priority: undefined,
        frequency: undefined,
        interval: undefined,
        nextRunAt: undefined,
        assignedToId: undefined,
        childId: 'child-id',
        version: { increment: 1 },
      },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'task_routine.updated', resourceId: 'routine-id' }),
    );
  });

  it('does not update a routine outside the caller family', async () => {
    const prisma = { taskRoutine: { findFirst: jest.fn().mockResolvedValue(null) } };
    const membership = {
      requireMembership: jest.fn().mockResolvedValue({ familyId: 'family-id' }),
    };
    const service = new TaskRoutinesService(
      prisma as never,
      membership as never,
      {} as never,
      {} as never,
    );

    await expect(service.update('foreign-routine', 'user-id', { title: 'Nope' })).rejects.toThrow(
      'Task routine not found',
    );
  });

  it('reports a version conflict when an active routine changed concurrently', async () => {
    const prisma = {
      taskRoutine: {
        findFirst: jest.fn().mockResolvedValue(routine),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const membership = {
      requireMembership: jest.fn().mockResolvedValue({ familyId: 'family-id' }),
    };
    const service = new TaskRoutinesService(
      prisma as never,
      membership as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.update('routine-id', 'user-id', { title: 'Stale' }, 3),
    ).rejects.toMatchObject({
      status: 409,
    });
  });

  it('lists active and archived routines separately within the caller family', async () => {
    const prisma = {
      taskRoutine: { findMany: jest.fn().mockResolvedValue([routine]) },
    };
    const membership = {
      requireMembership: jest.fn().mockResolvedValue({ familyId: 'family-id' }),
    };
    const service = new TaskRoutinesService(
      prisma as never,
      membership as never,
      {} as never,
      {} as never,
    );

    await expect(service.list('user-id')).resolves.toEqual([routine]);
    await expect(service.listArchived('user-id')).resolves.toEqual([routine]);
    expect(prisma.taskRoutine.findMany).toHaveBeenNthCalledWith(1, {
      where: { familyId: 'family-id', active: true },
      orderBy: { nextRunAt: 'asc' },
    });
    expect(prisma.taskRoutine.findMany).toHaveBeenNthCalledWith(2, {
      where: { familyId: 'family-id', active: false },
      orderBy: { updatedAt: 'desc' },
    });
  });

  it('restores an archived routine with optimistic concurrency and records the lifecycle event', async () => {
    const restoredRoutine = { ...routine, active: true, version: 5 };
    const prisma = {
      taskRoutine: {
        findFirst: jest.fn().mockResolvedValue({ ...routine, active: false, version: 4 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(restoredRoutine),
      },
    };
    const membership = {
      requireMembership: jest.fn().mockResolvedValue({ familyId: 'family-id' }),
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const notifications = { notifyFamilyMembers: jest.fn().mockResolvedValue(undefined) };
    const service = new TaskRoutinesService(
      prisma as never,
      membership as never,
      audit as never,
      notifications as never,
    );

    await expect(service.restore('routine-id', 'user-id', 4)).resolves.toEqual(restoredRoutine);
    expect(prisma.taskRoutine.updateMany).toHaveBeenCalledWith({
      where: { id: 'routine-id', familyId: 'family-id', active: false, version: 4 },
      data: { active: true, version: { increment: 1 } },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'task_routine.restored', resourceId: 'routine-id' }),
    );
    expect(notifications.notifyFamilyMembers).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'TASK_ROUTINE_RESTORED', body: 'Weekly task' }),
    );
  });

  it('does not restore a routine outside the caller family', async () => {
    const prisma = { taskRoutine: { findFirst: jest.fn().mockResolvedValue(null) } };
    const membership = {
      requireMembership: jest.fn().mockResolvedValue({ familyId: 'family-id' }),
    };
    const service = new TaskRoutinesService(
      prisma as never,
      membership as never,
      {} as never,
      {} as never,
    );

    await expect(service.restore('foreign-routine', 'user-id', 4)).rejects.toThrow(
      'Task routine not found',
    );
  });

  it('reports a version conflict when an archived routine changed concurrently', async () => {
    const prisma = {
      taskRoutine: {
        findFirst: jest.fn().mockResolvedValue({ ...routine, active: false, version: 4 }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const membership = {
      requireMembership: jest.fn().mockResolvedValue({ familyId: 'family-id' }),
    };
    const service = new TaskRoutinesService(
      prisma as never,
      membership as never,
      {} as never,
      {} as never,
    );

    await expect(service.restore('routine-id', 'user-id', 4)).rejects.toMatchObject({
      status: 409,
    });
  });

  it('archives an active routine with optimistic concurrency', async () => {
    const prisma = {
      taskRoutine: {
        findFirst: jest.fn().mockResolvedValue(routine),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const membership = {
      requireMembership: jest.fn().mockResolvedValue({ familyId: 'family-id' }),
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const notifications = { notifyFamilyMembers: jest.fn().mockResolvedValue(undefined) };
    const service = new TaskRoutinesService(
      prisma as never,
      membership as never,
      audit as never,
      notifications as never,
    );

    await expect(service.archive('routine-id', 'user-id', 3)).resolves.toBeUndefined();
    expect(prisma.taskRoutine.updateMany).toHaveBeenCalledWith({
      where: { id: 'routine-id', familyId: 'family-id', active: true, version: 3 },
      data: { active: false, version: { increment: 1 } },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'task_routine.archived', resourceId: 'routine-id' }),
    );
  });
});
