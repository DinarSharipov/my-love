import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  FamilyDissolutionStatus,
  FamilyInvitationStatus,
  FamilyMemberRole,
  FamilyStatus,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { DissolutionResponseDto } from './dto/dissolution-response.dto';
import { PrismaService } from '../../database/prisma.service';
import { FamilyMembershipService } from '../family-members/family-membership.service';
import { FamilyResponseDto } from './dto/family-response.dto';
import { AuditService } from '../../common/audit/audit.service';
import { paginationMeta } from '../../common/dto/pagination-response.dto';
import { PaginatedAuditEventsResponseDto } from './dto/paginated-audit-events-response.dto';
import { AuditEventsQueryDto } from './dto/audit-events-query.dto';
import { FamilyDashboardResponseDto } from './dto/family-dashboard-response.dto';

@Injectable()
export class FamiliesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: FamilyMembershipService,
    private readonly audit: AuditService,
  ) {}

  async findMine(userId: string): Promise<FamilyResponseDto> {
    const { familyId } = await this.membership.requireMembership(userId);
    const family = await this.prisma.family.findUnique({
      where: { id: familyId },
      include: {
        members: {
          include: { user: true },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });
    if (!family) throw new NotFoundException('Family not found');
    return FamilyResponseDto.fromEntity(family);
  }

  async dashboard(userId: string): Promise<FamilyDashboardResponseDto> {
    const { familyId } = await this.membership.requireMembership(userId);
    const now = new Date();
    const [
      openTasks,
      overdueTasks,
      uncheckedShoppingItems,
      unreadNotifications,
      upcomingEvents,
      nextEvents,
    ] = await this.prisma.$transaction([
      this.prisma.task.count({ where: { familyId, status: 'OPEN' } }),
      this.prisma.task.count({ where: { familyId, status: 'OPEN', dueAt: { lt: now } } }),
      this.prisma.shoppingItem.count({
        where: { checked: false, list: { familyId, archived: false } },
      }),
      this.prisma.notification.count({
        where: { userId, readAt: null, OR: [{ familyId }, { familyId: null }] },
      }),
      this.prisma.familyEvent.count({
        where: { familyId, deletedAt: null, scheduledAt: { gte: now } },
      }),
      this.prisma.familyEvent.findMany({
        where: { familyId, deletedAt: null, scheduledAt: { gte: now } },
        select: { id: true, name: true, scheduledAt: true },
        orderBy: { scheduledAt: 'asc' },
        take: 5,
      }),
    ]);
    return {
      openTasks,
      overdueTasks,
      uncheckedShoppingItems,
      unreadNotifications,
      upcomingEvents,
      nextEvents,
      generatedAt: now,
    };
  }

  async listAuditEvents(
    userId: string,
    query: AuditEventsQueryDto,
  ): Promise<PaginatedAuditEventsResponseDto> {
    const { familyId } = await this.membership.requireMembership(userId);
    const where = {
      familyId,
      ...(query.action ? { action: query.action } : {}),
      ...(query.resourceType ? { resourceType: query.resourceType } : {}),
    };
    const [total, events] = await this.prisma.$transaction([
      this.prisma.auditEvent.count({ where }),
      this.prisma.auditEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);
    return {
      ...paginationMeta(total, query.page, query.limit),
      data: events.map((event) => ({
        id: event.id,
        actorId: event.actorId,
        familyId: event.familyId as string,
        action: event.action,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        metadata: event.metadata ?? null,
        createdAt: event.createdAt,
      })),
    };
  }

  async leave(userId: string): Promise<void> {
    const context = await this.membership.requireMembership(userId);
    await this.prisma.$transaction(async (tx) => {
      await tx.familyMember.delete({ where: { userId } });
      const remaining = await tx.familyMember.count({ where: { familyId: context.familyId } });
      if (remaining === 0) {
        await tx.family.update({
          where: { id: context.familyId },
          data: { status: FamilyStatus.ARCHIVED, archivedAt: new Date() },
        });
      }
      await tx.familyInvitation.updateMany({
        where: { senderId: userId, status: FamilyInvitationStatus.PENDING },
        data: { status: FamilyInvitationStatus.CANCELLED, respondedAt: new Date() },
      });
      await this.audit.record(
        {
          actorId: userId,
          familyId: context.familyId,
          action: 'family.membership.left',
          resourceType: 'family',
          resourceId: context.familyId,
        },
        tx,
      );
    });
  }

  async archive(userId: string): Promise<void> {
    const context = await this.membership.requirePartner(userId);
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.family.updateMany({
        where: { id: context.familyId, status: FamilyStatus.ACTIVE },
        data: { status: FamilyStatus.ARCHIVED, archivedAt: new Date() },
      });
      if (result.count !== 1) throw new ForbiddenException('Family is no longer active');
      await tx.familyInvitation.updateMany({
        where: { senderId: userId, status: FamilyInvitationStatus.PENDING },
        data: { status: FamilyInvitationStatus.CANCELLED, respondedAt: new Date() },
      });
      await this.audit.record(
        {
          actorId: userId,
          familyId: context.familyId,
          action: 'family.archived',
          resourceType: 'family',
          resourceId: context.familyId,
        },
        tx,
      );
    });
  }

  async restore(userId: string): Promise<void> {
    const membership = await this.prisma.familyMember.findUnique({
      where: { userId },
      select: { familyId: true, role: true, family: { select: { status: true } } },
    });
    if (!membership || membership.role !== FamilyMemberRole.PARTNER) {
      throw new ForbiddenException('A partner membership is required');
    }
    if (membership.family.status !== FamilyStatus.ARCHIVED) {
      throw new ForbiddenException('Only an archived family can be restored');
    }
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.family.updateMany({
        where: { id: membership.familyId, status: FamilyStatus.ARCHIVED },
        data: { status: FamilyStatus.ACTIVE, archivedAt: null },
      });
      if (result.count !== 1) throw new ForbiddenException('Family is no longer archived');
      await this.audit.record(
        {
          actorId: userId,
          familyId: membership.familyId,
          action: 'family.restored',
          resourceType: 'family',
          resourceId: membership.familyId,
        },
        tx,
      );
    });
  }

  async requestDissolution(userId: string): Promise<DissolutionResponseDto> {
    const context = await this.membership.requirePartner(userId);
    const request = await this.prisma.$transaction(async (tx) => {
      const created = await tx.familyDissolutionRequest.create({
        data: { id: randomUUID(), familyId: context.familyId, requestedById: userId },
      });
      await this.audit.record(
        {
          actorId: userId,
          familyId: context.familyId,
          action: 'family.dissolution.requested',
          resourceType: 'family_dissolution_request',
          resourceId: created.id,
        },
        tx,
      );
      return created;
    });
    return request;
  }

  async confirmDissolution(userId: string): Promise<void> {
    const context = await this.membership.requirePartner(userId);
    await this.prisma.$transaction(async (tx) => {
      const request = await tx.familyDissolutionRequest.findFirst({
        where: { familyId: context.familyId, status: FamilyDissolutionStatus.PENDING },
      });
      if (!request || request.requestedById === userId)
        throw new ForbiddenException('A second partner confirmation is required');
      await tx.familyDissolutionRequest.update({
        where: { id: request.id },
        data: {
          status: FamilyDissolutionStatus.CONFIRMED,
          confirmedById: userId,
          confirmedAt: new Date(),
        },
      });
      await tx.family.update({
        where: { id: context.familyId },
        data: { status: FamilyStatus.DISSOLVED, dissolvedAt: new Date() },
      });
      await this.audit.record(
        {
          actorId: userId,
          familyId: context.familyId,
          action: 'family.dissolved',
          resourceType: 'family',
          resourceId: context.familyId,
          metadata: { confirmation: 'second_partner' },
        },
        tx,
      );
    });
  }

  async cancelDissolution(userId: string): Promise<void> {
    const context = await this.membership.requirePartner(userId);
    const result = await this.prisma.familyDissolutionRequest.updateMany({
      where: { familyId: context.familyId, status: FamilyDissolutionStatus.PENDING },
      data: { status: FamilyDissolutionStatus.CANCELLED },
    });
    if (result.count > 0) {
      await this.audit.record({
        actorId: userId,
        familyId: context.familyId,
        action: 'family.dissolution.cancelled',
        resourceType: 'family',
        resourceId: context.familyId,
      });
    }
  }
}
