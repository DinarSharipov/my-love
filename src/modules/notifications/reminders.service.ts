import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FamilyMembershipService } from '../family-members/family-membership.service';
@Injectable()
export class RemindersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: FamilyMembershipService,
  ) {}
  async create(userId: string, taskId: string, remindAt: string) {
    const { familyId } = await this.membership.requireMembership(userId);
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, familyId, status: { not: 'ARCHIVED' } },
    });
    if (!task) throw new NotFoundException('Task not found');
    return this.prisma.taskReminder.create({
      data: { taskId, userId, remindAt: new Date(remindAt) },
    });
  }
  async list(userId: string, taskId: string) {
    const { familyId } = await this.membership.requireMembership(userId);
    return this.prisma.taskReminder.findMany({
      where: { taskId, userId, task: { familyId } },
      orderBy: { remindAt: 'asc' },
    });
  }
  async remove(userId: string, id: string) {
    const { familyId } = await this.membership.requireMembership(userId);
    const result = await this.prisma.taskReminder.deleteMany({
      where: { id, userId, task: { familyId } },
    });
    if (!result.count) throw new NotFoundException('Reminder not found');
  }
}
