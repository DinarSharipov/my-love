import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TaskRoutineFrequency } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { FamilyMembershipService } from '../family-members/family-membership.service';
import { AuditService } from '../../common/audit/audit.service';
import { CreateTaskRoutineDto } from './dto/create-task-routine.dto';
import { TaskRoutineResponseDto } from './dto/task-routine-response.dto';
import { NotificationProducerService } from '../../common/notifications/notification-producer.service';
import { VersionConflictException } from '../../common/http/version-conflict.exception';
import { UpdateTaskRoutineDto } from './dto/update-task-routine.dto';
@Injectable()
export class TaskRoutinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: FamilyMembershipService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationProducerService,
  ) {}
  async create(userId: string, dto: CreateTaskRoutineDto): Promise<TaskRoutineResponseDto> {
    const { familyId } = await this.membership.requireMembership(userId);
    if (dto.assignedToId) await this.ensureMember(familyId, dto.assignedToId);
    if (dto.childId) await this.ensureFamilyChild(familyId, dto.childId);
    const routine = await this.prisma.taskRoutine.create({
      data: {
        familyId,
        createdById: userId,
        assignedToId: dto.assignedToId || null,
        childId: dto.childId || null,
        title: dto.title,
        description: dto.description || null,
        priority: dto.priority,
        frequency: dto.frequency,
        interval: dto.interval,
        nextRunAt: new Date(dto.nextRunAt),
      },
    });
    await this.audit.record({
      actorId: userId,
      familyId,
      action: 'task_routine.created',
      resourceType: 'task_routine',
      resourceId: routine.id,
    });
    await this.notifications.notifyFamilyMembers({
      familyId,
      actorId: userId,
      type: 'TASK_ROUTINE_CREATED',
      title: 'Создана регулярная задача',
      body: routine.title,
    });
    return TaskRoutineResponseDto.fromEntity(routine);
  }
  async list(userId: string): Promise<TaskRoutineResponseDto[]> {
    const { familyId } = await this.membership.requireMembership(userId);
    const rows = await this.prisma.taskRoutine.findMany({
      where: { familyId, active: true },
      orderBy: { nextRunAt: 'asc' },
    });
    return rows.map((row) => TaskRoutineResponseDto.fromEntity(row));
  }

  async listArchived(userId: string): Promise<TaskRoutineResponseDto[]> {
    const { familyId } = await this.membership.requireMembership(userId);
    const rows = await this.prisma.taskRoutine.findMany({
      where: { familyId, active: false },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((row) => TaskRoutineResponseDto.fromEntity(row));
  }
  async update(
    id: string,
    userId: string,
    dto: UpdateTaskRoutineDto,
    expectedVersion?: number,
  ): Promise<TaskRoutineResponseDto> {
    const { familyId } = await this.membership.requireMembership(userId);
    if (dto.assignedToId) await this.ensureMember(familyId, dto.assignedToId);
    if (dto.childId) await this.ensureFamilyChild(familyId, dto.childId);
    const current = await this.prisma.taskRoutine.findFirst({
      where: { id, familyId, active: true },
    });
    if (!current) throw new NotFoundException('Task routine not found');
    const result = await this.prisma.taskRoutine.updateMany({
      where: {
        id,
        familyId,
        active: true,
        ...(expectedVersion === undefined ? {} : { version: expectedVersion }),
      },
      data: {
        title: dto.title,
        description: dto.description === undefined ? undefined : dto.description || null,
        priority: dto.priority,
        frequency: dto.frequency,
        interval: dto.interval,
        nextRunAt: dto.nextRunAt === undefined ? undefined : new Date(dto.nextRunAt),
        assignedToId: dto.assignedToId === undefined ? undefined : dto.assignedToId || null,
        childId: dto.childId === undefined ? undefined : dto.childId || null,
        version: { increment: 1 },
      },
    });
    if (result.count !== 1) {
      if (expectedVersion !== undefined) throw new VersionConflictException(expectedVersion);
      throw new NotFoundException('Task routine not found');
    }
    const routine = await this.prisma.taskRoutine.findUniqueOrThrow({ where: { id } });
    await this.audit.record({
      actorId: userId,
      familyId,
      action: 'task_routine.updated',
      resourceType: 'task_routine',
      resourceId: id,
    });
    await this.notifications.notifyFamilyMembers({
      familyId,
      actorId: userId,
      type: 'TASK_ROUTINE_UPDATED',
      title: 'Регулярная задача изменена',
      body: routine.title,
    });
    return TaskRoutineResponseDto.fromEntity(routine);
  }
  async generate(
    id: string,
    userId: string,
  ): Promise<{ taskId: string; routine: TaskRoutineResponseDto }> {
    const { familyId } = await this.membership.requireMembership(userId);
    const result = await this.prisma.$transaction(async (tx) => {
      const routine = await tx.taskRoutine.findFirst({ where: { id, familyId, active: true } });
      if (!routine) throw new NotFoundException('Task routine not found');
      const task = await tx.task.create({
        data: {
          familyId,
          createdById: userId,
          assignedToId: routine.assignedToId,
          childId: routine.childId,
          title: routine.title,
          description: routine.description,
          priority: routine.priority,
          dueAt: routine.nextRunAt,
        },
      });
      const next = new Date(routine.nextRunAt);
      if (routine.frequency === TaskRoutineFrequency.DAILY)
        next.setUTCDate(next.getUTCDate() + routine.interval);
      else next.setUTCDate(next.getUTCDate() + 7 * routine.interval);
      const updated = await tx.taskRoutine.updateMany({
        where: { id, familyId, active: true, version: routine.version },
        data: { nextRunAt: next, version: { increment: 1 } },
      });
      if (updated.count !== 1) throw new ConflictException('Routine was changed concurrently');
      await this.audit.record(
        {
          actorId: userId,
          familyId,
          action: 'task_routine.generated',
          resourceType: 'task',
          resourceId: task.id,
          metadata: { routineId: routine.id },
        },
        tx,
      );
      return {
        taskId: task.id,
        routine: await tx.taskRoutine.findUniqueOrThrow({ where: { id } }),
      };
    });
    await this.notifications.notifyFamilyMembers({
      familyId,
      actorId: userId,
      type: 'TASK_ROUTINE_GENERATED',
      title: 'Создана задача по расписанию',
      body: result.routine.title,
    });
    return { taskId: result.taskId, routine: TaskRoutineResponseDto.fromEntity(result.routine) };
  }
  async restore(
    id: string,
    userId: string,
    expectedVersion?: number,
  ): Promise<TaskRoutineResponseDto> {
    const { familyId } = await this.membership.requireMembership(userId);
    const current = await this.prisma.taskRoutine.findFirst({
      where: { id, familyId, active: false },
    });
    if (!current) throw new NotFoundException('Task routine not found');
    const result = await this.prisma.taskRoutine.updateMany({
      where: {
        id,
        familyId,
        active: false,
        ...(expectedVersion === undefined ? {} : { version: expectedVersion }),
      },
      data: { active: true, version: { increment: 1 } },
    });
    if (result.count !== 1) {
      if (expectedVersion !== undefined) throw new VersionConflictException(expectedVersion);
      throw new NotFoundException('Task routine not found');
    }
    const routine = await this.prisma.taskRoutine.findUniqueOrThrow({ where: { id } });
    await this.audit.record({
      actorId: userId,
      familyId,
      action: 'task_routine.restored',
      resourceType: 'task_routine',
      resourceId: id,
    });
    await this.notifications.notifyFamilyMembers({
      familyId,
      actorId: userId,
      type: 'TASK_ROUTINE_RESTORED',
      title: 'Регулярная задача восстановлена',
      body: routine.title,
    });
    return TaskRoutineResponseDto.fromEntity(routine);
  }

  async archive(id: string, userId: string, expectedVersion?: number): Promise<void> {
    const { familyId } = await this.membership.requireMembership(userId);
    const current = await this.prisma.taskRoutine.findFirst({
      where: { id, familyId, active: true },
    });
    if (!current) throw new NotFoundException('Task routine not found');
    const result = await this.prisma.taskRoutine.updateMany({
      where: {
        id,
        familyId,
        active: true,
        ...(expectedVersion === undefined ? {} : { version: expectedVersion }),
      },
      data: { active: false, version: { increment: 1 } },
    });
    if (result.count !== 1) {
      if (expectedVersion !== undefined) throw new VersionConflictException(expectedVersion);
      throw new NotFoundException('Task routine not found');
    }
    await this.audit.record({
      actorId: userId,
      familyId,
      action: 'task_routine.archived',
      resourceType: 'task_routine',
      resourceId: id,
    });
    await this.notifications.notifyFamilyMembers({
      familyId,
      actorId: userId,
      type: 'TASK_ROUTINE_ARCHIVED',
      title: 'Регулярная задача отключена',
    });
  }

  async generateDue(now = new Date(), limit = 100): Promise<{ generated: number }> {
    const due = await this.prisma.taskRoutine.findMany({
      where: { active: true, nextRunAt: { lte: now }, family: { status: 'ACTIVE' } },
      orderBy: { nextRunAt: 'asc' },
      take: limit,
    });
    let generated = 0;
    for (const candidate of due) {
      const result = await this.prisma.$transaction(async (tx) => {
        const routine = await tx.taskRoutine.findFirst({
          where: {
            id: candidate.id,
            active: true,
            nextRunAt: { lte: now },
            version: candidate.version,
            family: { status: 'ACTIVE' },
          },
        });
        if (!routine) return null;
        let next = this.nextRun(routine.nextRunAt, routine.frequency, routine.interval);
        while (next <= now) {
          next = this.nextRun(next, routine.frequency, routine.interval);
        }
        const claimed = await tx.taskRoutine.updateMany({
          where: { id: routine.id, active: true, version: routine.version },
          data: { nextRunAt: next, version: { increment: 1 } },
        });
        if (claimed.count !== 1) return null;
        const task = await tx.task.create({
          data: {
            familyId: routine.familyId,
            createdById: routine.createdById,
            assignedToId: routine.assignedToId,
            childId: routine.childId,
            title: routine.title,
            description: routine.description,
            priority: routine.priority,
            dueAt: now,
          },
        });
        await this.audit.record(
          {
            actorId: routine.createdById,
            familyId: routine.familyId,
            action: 'task_routine.generated',
            resourceType: 'task',
            resourceId: task.id,
            metadata: { routineId: routine.id, scheduled: true },
          },
          tx,
        );
        return { routine, taskId: task.id };
      });
      if (!result) continue;
      generated += 1;
      await this.notifications.notifyFamilyMembers({
        familyId: result.routine.familyId,
        actorId: result.routine.createdById,
        type: 'TASK_ROUTINE_GENERATED',
        title: 'Создана задача по расписанию',
        body: result.routine.title,
      });
    }
    return { generated };
  }

  private nextRun(current: Date, frequency: TaskRoutineFrequency, interval: number): Date {
    const next = new Date(current);
    next.setUTCDate(
      next.getUTCDate() + (frequency === TaskRoutineFrequency.DAILY ? interval : 7 * interval),
    );
    return next;
  }
  private async ensureMember(familyId: string, userId: string): Promise<void> {
    const member = await this.prisma.familyMember.findFirst({ where: { familyId, userId } });
    if (!member) throw new ForbiddenException('Assigned user must belong to the family');
  }
  private async ensureFamilyChild(familyId: string, childId: string): Promise<void> {
    const child = await this.prisma.childProfile.findFirst({ where: { id: childId, familyId } });
    if (!child) throw new ForbiddenException('Routine child must belong to the family');
  }
}
