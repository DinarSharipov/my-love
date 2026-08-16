import { NotFoundException } from '@nestjs/common';
import { RemindersService } from './reminders.service';

describe('RemindersService', () => {
  it('does not create a reminder for a task in another family', async () => {
    const prisma = {
      task: { findFirst: jest.fn().mockResolvedValue(null) },
      taskReminder: { create: jest.fn() },
    };
    const membership = {
      requireMembership: jest.fn().mockResolvedValue({ familyId: 'family-id' }),
    };
    const service = new RemindersService(prisma as never, membership as never);

    await expect(
      service.create('user-id', 'foreign-task-id', '2026-08-17T10:00:00.000Z'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.task.findFirst).toHaveBeenCalledWith({
      where: { id: 'foreign-task-id', familyId: 'family-id', status: { not: 'ARCHIVED' } },
    });
    expect(prisma.taskReminder.create).not.toHaveBeenCalled();
  });

  it('scopes reminder deletion to its owner and current family', async () => {
    const prisma = {
      taskReminder: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    const membership = {
      requireMembership: jest.fn().mockResolvedValue({ familyId: 'family-id' }),
    };
    const service = new RemindersService(prisma as never, membership as never);

    await expect(service.remove('user-id', 'foreign-reminder-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.taskReminder.deleteMany).toHaveBeenCalledWith({
      where: {
        id: 'foreign-reminder-id',
        userId: 'user-id',
        task: { familyId: 'family-id' },
      },
    });
  });
});
