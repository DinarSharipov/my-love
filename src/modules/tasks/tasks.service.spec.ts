import { ForbiddenException } from '@nestjs/common';
import { TasksService } from './tasks.service';

describe('TasksService', () => {
  it('rejects assignment to a user outside the current family', async () => {
    const prisma = {
      familyMember: { findFirst: jest.fn().mockResolvedValue(null) },
      task: { create: jest.fn() },
    };
    const membership = {
      requireMembership: jest.fn().mockResolvedValue({ familyId: 'family-id' }),
    };
    const service = new TasksService(
      prisma as never,
      membership as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.create('actor-id', {
        title: 'Task',
        assignedToId: 'foreign-user-id',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.task.create).not.toHaveBeenCalled();
  });
});
