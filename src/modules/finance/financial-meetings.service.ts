import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FamilyMemberRole,
  FinancialDecisionStatus,
  FinancialMeetingStatus,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { NotificationProducerService } from '../../common/notifications/notification-producer.service';
import { PrismaService } from '../../database/prisma.service';
import { FamilyMembershipService } from '../family-members/family-membership.service';
import {
  CreateFinancialDecisionDto,
  CreateFinancialMeetingDto,
  UpdateFinancialMeetingDto,
} from './dto/financial-meeting.dto';

const meetingInclude = { decisions: { orderBy: { createdAt: 'asc' as const } } };

@Injectable()
export class FinancialMeetingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: FamilyMembershipService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationProducerService,
  ) {}

  async create(userId: string, dto: CreateFinancialMeetingDto) {
    const context = await this.membership.requirePartner(userId);
    const scheduledAt = this.future(dto.scheduledAt);
    return this.prisma.$transaction(async (tx) => {
      const recipientId = await this.otherPartner(tx, context.familyId, userId);
      const meeting = await tx.financialMeeting.create({
        data: {
          familyId: context.familyId,
          createdById: userId,
          title: dto.title.trim(),
          scheduledAt,
          notes: dto.notes?.trim() || null,
        },
        include: meetingInclude,
      });
      await this.audit.record(
        {
          actorId: userId,
          familyId: context.familyId,
          action: 'financial_meeting.created',
          resourceType: 'financial_meeting',
          resourceId: meeting.id,
        },
        tx,
      );
      await this.notifications.notifyUserInTransaction(tx, {
        userId: recipientId,
        familyId: context.familyId,
        type: 'FINANCIAL_MEETING_SCHEDULED',
        title: 'Запланирована финансовая встреча',
        body: meeting.title,
      });
      return this.serializeMeeting(meeting);
    });
  }

  async list(userId: string) {
    const { familyId } = await this.membership.requirePartner(userId);
    const meetings = await this.prisma.financialMeeting.findMany({
      where: { familyId },
      include: meetingInclude,
      orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'asc' }],
    });
    return meetings.map((meeting) => this.serializeMeeting(meeting));
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateFinancialMeetingDto,
    expectedVersion?: number,
  ) {
    if (dto.title === undefined && dto.scheduledAt === undefined && dto.notes === undefined) {
      throw new BadRequestException('At least one field must be provided');
    }
    const context = await this.membership.requirePartner(userId);
    return this.prisma.$transaction(async (tx) => {
      const current = await this.meeting(tx, id, context.familyId);
      if (current.createdById !== userId)
        throw new ForbiddenException('Only the meeting creator can update it');
      if (current.status !== FinancialMeetingStatus.SCHEDULED)
        throw new ConflictException('Only scheduled meetings can be updated');
      const scheduledAt = dto.scheduledAt ? this.future(dto.scheduledAt) : current.scheduledAt;
      const result = await tx.financialMeeting.updateMany({
        where: {
          id,
          familyId: context.familyId,
          status: FinancialMeetingStatus.SCHEDULED,
          version: expectedVersion ?? current.version,
        },
        data: {
          title: dto.title?.trim(),
          scheduledAt,
          notes: dto.notes === undefined ? undefined : dto.notes?.trim() || null,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1)
        throw new ConflictException('Financial meeting was changed concurrently');
      const updated = await tx.financialMeeting.findUniqueOrThrow({
        where: { id },
        include: meetingInclude,
      });
      await this.audit.record(
        {
          actorId: userId,
          familyId: context.familyId,
          action: 'financial_meeting.updated',
          resourceType: 'financial_meeting',
          resourceId: id,
        },
        tx,
      );
      await this.notifications.notifyUserInTransaction(tx, {
        userId: await this.otherPartner(tx, context.familyId, userId),
        familyId: context.familyId,
        type: 'FINANCIAL_MEETING_UPDATED',
        title: 'Финансовая встреча изменена',
        body: updated.title,
      });
      return this.serializeMeeting(updated);
    });
  }

  async complete(userId: string, id: string, expectedVersion?: number) {
    return this.setMeetingStatus(userId, id, FinancialMeetingStatus.COMPLETED, expectedVersion);
  }

  async cancel(userId: string, id: string, expectedVersion?: number): Promise<void> {
    const context = await this.membership.requirePartner(userId);
    await this.prisma.$transaction(async (tx) => {
      const current = await this.meeting(tx, id, context.familyId);
      if (current.createdById !== userId)
        throw new ForbiddenException('Only the meeting creator can cancel it');
      if (current.status !== FinancialMeetingStatus.SCHEDULED)
        throw new ConflictException('Only scheduled meetings can be cancelled');
      const result = await tx.financialMeeting.updateMany({
        where: {
          id,
          familyId: context.familyId,
          status: FinancialMeetingStatus.SCHEDULED,
          version: expectedVersion ?? current.version,
        },
        data: { status: FinancialMeetingStatus.CANCELLED, version: { increment: 1 } },
      });
      if (result.count !== 1)
        throw new ConflictException('Financial meeting was changed concurrently');
      await this.audit.record(
        {
          actorId: userId,
          familyId: context.familyId,
          action: 'financial_meeting.cancelled',
          resourceType: 'financial_meeting',
          resourceId: id,
        },
        tx,
      );
      await this.notifications.notifyUserInTransaction(tx, {
        userId: await this.otherPartner(tx, context.familyId, userId),
        familyId: context.familyId,
        type: 'FINANCIAL_MEETING_CANCELLED',
        title: 'Финансовая встреча отменена',
        body: current.title,
      });
    });
  }

  async createDecision(userId: string, meetingId: string, dto: CreateFinancialDecisionDto) {
    const context = await this.membership.requirePartner(userId);
    return this.prisma.$transaction(async (tx) => {
      const meeting = await this.meeting(tx, meetingId, context.familyId);
      if (meeting.status === FinancialMeetingStatus.CANCELLED)
        throw new ConflictException('A cancelled meeting cannot have decisions');
      const decision = await tx.financialDecision.create({
        data: {
          meetingId,
          createdById: userId,
          title: dto.title.trim(),
          description: dto.description?.trim() || null,
        },
      });
      await this.audit.record(
        {
          actorId: userId,
          familyId: context.familyId,
          action: 'financial_decision.proposed',
          resourceType: 'financial_decision',
          resourceId: decision.id,
        },
        tx,
      );
      await this.notifications.notifyUserInTransaction(tx, {
        userId: await this.otherPartner(tx, context.familyId, userId),
        familyId: context.familyId,
        type: 'FINANCIAL_DECISION_PROPOSED',
        title: 'Нужно финансовое решение',
        body: decision.title,
      });
      return this.serializeDecision(decision);
    });
  }

  async respond(
    userId: string,
    meetingId: string,
    decisionId: string,
    status: 'AGREED' | 'REJECTED',
    expectedVersion?: number,
  ) {
    const context = await this.membership.requirePartner(userId);
    return this.prisma.$transaction(async (tx) => {
      await this.meeting(tx, meetingId, context.familyId);
      const decision = await tx.financialDecision.findFirst({
        where: { id: decisionId, meetingId, meeting: { familyId: context.familyId } },
      });
      if (!decision) throw new NotFoundException('Financial decision not found');
      if (decision.createdById === userId)
        throw new ForbiddenException('The decision creator cannot respond to it');
      if (decision.status !== FinancialDecisionStatus.PROPOSED)
        throw new ConflictException('Financial decision has already been answered');
      const result = await tx.financialDecision.updateMany({
        where: {
          id: decision.id,
          status: FinancialDecisionStatus.PROPOSED,
          version: expectedVersion ?? decision.version,
        },
        data: { status, respondedById: userId, respondedAt: new Date(), version: { increment: 1 } },
      });
      if (result.count !== 1)
        throw new ConflictException('Financial decision was changed concurrently');
      const responded = await tx.financialDecision.findUniqueOrThrow({
        where: { id: decision.id },
      });
      await this.audit.record(
        {
          actorId: userId,
          familyId: context.familyId,
          action: `financial_decision.${status.toLowerCase()}`,
          resourceType: 'financial_decision',
          resourceId: decision.id,
        },
        tx,
      );
      await this.notifications.notifyUserInTransaction(tx, {
        userId: decision.createdById,
        familyId: context.familyId,
        type:
          status === FinancialDecisionStatus.AGREED
            ? 'FINANCIAL_DECISION_AGREED'
            : 'FINANCIAL_DECISION_REJECTED',
        title:
          status === FinancialDecisionStatus.AGREED
            ? 'Финансовое решение согласовано'
            : 'Финансовое решение отклонено',
        body: decision.title,
      });
      return this.serializeDecision(responded);
    });
  }

  private async setMeetingStatus(
    userId: string,
    id: string,
    status: 'COMPLETED',
    expectedVersion?: number,
  ) {
    const context = await this.membership.requirePartner(userId);
    return this.prisma.$transaction(async (tx) => {
      const current = await this.meeting(tx, id, context.familyId);
      if (current.status !== FinancialMeetingStatus.SCHEDULED)
        throw new ConflictException('Only scheduled meetings can be completed');
      const result = await tx.financialMeeting.updateMany({
        where: {
          id,
          familyId: context.familyId,
          status: FinancialMeetingStatus.SCHEDULED,
          version: expectedVersion ?? current.version,
        },
        data: { status, version: { increment: 1 } },
      });
      if (result.count !== 1)
        throw new ConflictException('Financial meeting was changed concurrently');
      const completed = await tx.financialMeeting.findUniqueOrThrow({
        where: { id },
        include: meetingInclude,
      });
      await this.audit.record(
        {
          actorId: userId,
          familyId: context.familyId,
          action: 'financial_meeting.completed',
          resourceType: 'financial_meeting',
          resourceId: id,
        },
        tx,
      );
      await this.notifications.notifyUserInTransaction(tx, {
        userId: await this.otherPartner(tx, context.familyId, userId),
        familyId: context.familyId,
        type: 'FINANCIAL_MEETING_COMPLETED',
        title: 'Финансовая встреча завершена',
        body: completed.title,
      });
      return this.serializeMeeting(completed);
    });
  }

  private async meeting(tx: Prisma.TransactionClient, id: string, familyId: string) {
    const meeting = await tx.financialMeeting.findFirst({ where: { id, familyId } });
    if (!meeting) throw new NotFoundException('Financial meeting not found');
    return meeting;
  }

  private async otherPartner(tx: Prisma.TransactionClient, familyId: string, userId: string) {
    const partner = await tx.familyMember.findFirst({
      where: { familyId, role: FamilyMemberRole.PARTNER, userId: { not: userId } },
      select: { userId: true },
    });
    if (!partner)
      throw new ConflictException('A second partner is required for financial meetings');
    return partner.userId;
  }

  private future(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime()) || date <= new Date())
      throw new BadRequestException('Meeting date must be in the future');
    return date;
  }

  private serializeDecision(decision: {
    id: string;
    meetingId: string;
    createdById: string;
    respondedById: string | null;
    title: string;
    description: string | null;
    status: FinancialDecisionStatus;
    respondedAt: Date | null;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return { ...decision };
  }

  private serializeMeeting(meeting: {
    id: string;
    createdById: string;
    title: string;
    scheduledAt: Date;
    notes: string | null;
    status: FinancialMeetingStatus;
    version: number;
    createdAt: Date;
    updatedAt: Date;
    decisions: Array<{
      id: string;
      meetingId: string;
      createdById: string;
      respondedById: string | null;
      title: string;
      description: string | null;
      status: FinancialDecisionStatus;
      respondedAt: Date | null;
      version: number;
      createdAt: Date;
      updatedAt: Date;
    }>;
  }) {
    return {
      ...meeting,
      decisions: meeting.decisions.map((decision) => this.serializeDecision(decision)),
    };
  }
}
