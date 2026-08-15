import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TaskStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { FamilyMembershipService } from '../family-members/family-membership.service';
import { AuditService } from '../../common/audit/audit.service';
import { NotificationProducerService } from '../../common/notifications/notification-producer.service';
import { paginationMeta } from '../../common/dto/pagination-response.dto';
import { VersionConflictException } from '../../common/http/version-conflict.exception';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksQueryDto } from './dto/tasks-query.dto';
import { TaskResponseDto } from './dto/task-response.dto';
@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: FamilyMembershipService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationProducerService,
  ) {}
  async create(userId: string, dto: CreateTaskDto): Promise<TaskResponseDto> {
    const { familyId } = await this.membership.requireMembership(userId);
    if (dto.assignedToId) await this.ensureFamilyMember(familyId, dto.assignedToId);
    const task = await this.prisma.task.create({
      data: {
        familyId,
        createdById: userId,
        title: dto.title,
        description: dto.description || null,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        priority: dto.priority,
        assignedToId: dto.assignedToId || null,
      },
    });
    await this.audit.record({
      actorId: userId,
      familyId,
      action: 'task.created',
      resourceType: 'task',
      resourceId: task.id,
    });
    await this.notifications.notifyFamilyMembers({
      familyId,
      actorId: userId,
      type: 'TASK_CREATED',
      title: 'Новая задача',
      body: task.title,
    });
    return TaskResponseDto.fromEntity(task);
  }
  async list(userId: string, query: TasksQueryDto) {
    const { familyId } = await this.membership.requireMembership(userId);
    const where: Prisma.TaskWhereInput = {
      familyId,
      ...(query.status ? { status: query.status } : {}),
    };
    const [total, tasks] = await this.prisma.$transaction([
      this.prisma.task.count({ where }),
      this.prisma.task.findMany({
        where,
        orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);
    return {
      data: tasks.map((task) => TaskResponseDto.fromEntity(task)),
      ...paginationMeta(total, query.page, query.limit),
    };
  }
  async update(
    id: string,
    userId: string,
    dto: UpdateTaskDto,
    expectedVersion?: number,
  ): Promise<TaskResponseDto> {
    const { familyId } = await this.membership.requireMembership(userId);
    if (dto.assignedToId) await this.ensureFamilyMember(familyId, dto.assignedToId);
    const current = await this.prisma.task.findFirst({
      where: { id, familyId, status: { not: TaskStatus.ARCHIVED } },
    });
    if (!current) throw new NotFoundException('Task not found');
    const result = await this.prisma.task.updateMany({
      where: {
        id,
        familyId,
        status: { not: TaskStatus.ARCHIVED },
        ...(expectedVersion === undefined ? {} : { version: expectedVersion }),
      },
      data: {
        title: dto.title,
        description: dto.description === undefined ? undefined : dto.description || null,
        dueAt: dto.dueAt === undefined ? undefined : dto.dueAt ? new Date(dto.dueAt) : null,
        priority: dto.priority,
        assignedToId: dto.assignedToId === undefined ? undefined : dto.assignedToId || null,
        version: { increment: 1 },
      },
    });
    if (result.count !== 1) {
      if (expectedVersion !== undefined) throw new VersionConflictException(expectedVersion);
      throw new NotFoundException('Task not found');
    }
    const task = await this.prisma.task.findUniqueOrThrow({ where: { id } });
    await this.audit.record({
      actorId: userId,
      familyId,
      action: 'task.updated',
      resourceType: 'task',
      resourceId: id,
    });
    return TaskResponseDto.fromEntity(task);
  }
  async setCompleted(
    id: string,
    userId: string,
    completed: boolean,
    expectedVersion?: number,
  ): Promise<TaskResponseDto> {
    const { familyId } = await this.membership.requireMembership(userId);
    const result = await this.prisma.task.updateMany({
      where: {
        id,
        familyId,
        status: completed ? TaskStatus.OPEN : TaskStatus.COMPLETED,
        ...(expectedVersion === undefined ? {} : { version: expectedVersion }),
      },
      data: {
        status: completed ? TaskStatus.COMPLETED : TaskStatus.OPEN,
        completedAt: completed ? new Date() : null,
        completedById: completed ? userId : null,
        version: { increment: 1 },
      },
    });
    if (result.count !== 1) {
      if (expectedVersion !== undefined) throw new VersionConflictException(expectedVersion);
      throw new ConflictException('Task status has changed');
    }
    const task = await this.prisma.task.findUniqueOrThrow({ where: { id } });
    await this.audit.record({
      actorId: userId,
      familyId,
      action: completed ? 'task.completed' : 'task.reopened',
      resourceType: 'task',
      resourceId: id,
    });
    await this.notifications.notifyFamilyMembers({
      familyId,
      actorId: userId,
      type: completed ? 'TASK_COMPLETED' : 'TASK_REOPENED',
      title: completed ? 'Задача выполнена' : 'Задача возвращена в работу',
      body: task.title,
    });
    return TaskResponseDto.fromEntity(task);
  }
  async archive(id: string, userId: string): Promise<void> {
    const { familyId } = await this.membership.requireMembership(userId);
    const result = await this.prisma.task.updateMany({
      where: { id, familyId, status: { not: TaskStatus.ARCHIVED } },
      data: { status: TaskStatus.ARCHIVED, version: { increment: 1 } },
    });
    if (result.count !== 1) throw new NotFoundException('Task not found');
    await this.audit.record({
      actorId: userId,
      familyId,
      action: 'task.archived',
      resourceType: 'task',
      resourceId: id,
    });
  }
  private async ensureFamilyMember(familyId: string, userId: string): Promise<void> {
    const member = await this.prisma.familyMember.findFirst({ where: { familyId, userId } });
    if (!member) throw new ForbiddenException('Assigned user must belong to the family');
  }
}
