import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { paginationMeta } from '../../common/dto/pagination-response.dto';
import { VersionConflictException } from '../../common/http/version-conflict.exception';
import { FamilyEventDecisionStatus, FamilyMemberRole, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { FamilyMembershipService } from '../family-members/family-membership.service';
import { CreateFamilyEventDto } from './dto/create-family-event.dto';
import { familyEventInclude, FamilyEventResponseDto } from './dto/family-event-response.dto';
import { FamilyEventsQueryDto } from './dto/family-events-query.dto';
import { PaginatedFamilyEventsResponseDto } from './dto/paginated-family-events-response.dto';
import { UpdateFamilyEventDto } from './dto/update-family-event.dto';
import { localDateStartUtc } from './local-date';
import { NotificationProducerService } from '../../common/notifications/notification-producer.service';

@Injectable()
export class FamilyEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: FamilyMembershipService,
    private readonly notifications: NotificationProducerService,
  ) {}

  async create(userId: string, dto: CreateFamilyEventDto): Promise<FamilyEventResponseDto> {
    const { familyId, timeZone } = await this.membership.requirePartner(userId);
    const scheduledAt = new Date(dto.scheduledAt);
    if (scheduledAt.getTime() <= Date.now()) {
      throw new BadRequestException('Event date must be in the future');
    }

    const partners = await this.prisma.familyMember.count({
      where: { familyId, role: FamilyMemberRole.PARTNER },
    });
    if (partners !== 2) {
      throw new ConflictException('A family must have exactly two partners to plan an event');
    }

    const event = await this.prisma.familyEvent.create({
      data: {
        familyId,
        proposedById: userId,
        name: dto.name,
        description: dto.description || null,
        scheduledAt,
        location: dto.location,
      },
      include: familyEventInclude,
    });
    await this.notifications.notifyFamilyMembers({
      familyId,
      actorId: userId,
      type: 'FAMILY_EVENT_PROPOSED',
      title: 'Новое семейное событие',
      body: `${dto.name} — требуется ваше подтверждение.`,
    });
    return FamilyEventResponseDto.fromEntity(event, timeZone);
  }

  async findAll(
    userId: string,
    query: FamilyEventsQueryDto,
  ): Promise<PaginatedFamilyEventsResponseDto> {
    const { familyId, timeZone } = await this.membership.requirePartner(userId);
    const dateFrom = query.dateFrom ? localDateStartUtc(query.dateFrom, timeZone) : undefined;
    const dateTo = query.dateTo ? localDateStartUtc(query.dateTo, timeZone) : undefined;
    if (dateFrom && dateTo && dateFrom >= dateTo) {
      throw new BadRequestException('dateFrom must be earlier than dateTo');
    }

    const where: Prisma.FamilyEventWhereInput = {
      familyId,
      deletedAt: null,
      ...(dateFrom || dateTo
        ? {
            scheduledAt: {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateTo ? { lt: dateTo } : {}),
            },
          }
        : {}),
    };
    const [events, total] = await this.prisma.$transaction([
      this.prisma.familyEvent.findMany({
        where,
        include: familyEventInclude,
        orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.familyEvent.count({ where }),
    ]);
    const now = new Date();

    return {
      data: events.map((event) => FamilyEventResponseDto.fromEntity(event, timeZone, now)),
      ...paginationMeta(total, query.page, query.limit),
    };
  }

  async findOne(eventId: string, userId: string): Promise<FamilyEventResponseDto> {
    const { familyId, timeZone } = await this.membership.requirePartner(userId);
    const event = await this.prisma.familyEvent.findFirst({
      where: { id: eventId, familyId, deletedAt: null },
      include: familyEventInclude,
    });
    if (!event) throw new NotFoundException('Family event not found');
    return FamilyEventResponseDto.fromEntity(event, timeZone);
  }

  async update(
    eventId: string,
    userId: string,
    dto: UpdateFamilyEventDto,
    expectedVersion?: number,
  ): Promise<FamilyEventResponseDto> {
    const { familyId, timeZone } = await this.membership.requirePartner(userId);
    if (
      dto.name === undefined &&
      dto.description === undefined &&
      dto.scheduledAt === undefined &&
      dto.location === undefined
    ) {
      throw new BadRequestException('At least one field must be provided');
    }

    const updated = await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.familyEvent.findFirst({
        where: { id: eventId, familyId, deletedAt: null },
      });
      if (!current) throw new NotFoundException('Family event not found');
      if (current.proposedById !== userId) {
        throw new ForbiddenException('Only the event creator can update it');
      }

      const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : current.scheduledAt;
      if (scheduledAt.getTime() <= Date.now()) {
        throw new BadRequestException('Event date must be in the future');
      }

      const result = await transaction.familyEvent.updateMany({
        where: {
          id: current.id,
          familyId,
          deletedAt: null,
          ...(expectedVersion !== undefined ? { version: expectedVersion } : {}),
        },
        data: {
          name: dto.name,
          description:
            dto.description === undefined
              ? undefined
              : dto.description.length > 0
                ? dto.description
                : null,
          scheduledAt: dto.scheduledAt ? scheduledAt : undefined,
          location: dto.location,
          status: FamilyEventDecisionStatus.PROPOSED,
          respondedById: null,
          respondedAt: null,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1 && expectedVersion !== undefined) {
        throw new VersionConflictException(expectedVersion);
      }
      if (result.count !== 1) throw new NotFoundException('Family event not found');

      return transaction.familyEvent.findFirstOrThrow({
        where: { id: current.id, familyId, deletedAt: null },
        include: familyEventInclude,
      });
    });

    await this.notifications.notifyFamilyMembers({
      familyId,
      actorId: userId,
      type: 'FAMILY_EVENT_UPDATED',
      title: 'Семейное событие изменено',
      body: `${updated.name} — требуется повторное подтверждение.`,
    });
    return FamilyEventResponseDto.fromEntity(updated, timeZone);
  }

  confirm(eventId: string, userId: string): Promise<FamilyEventResponseDto> {
    return this.respond(eventId, userId, FamilyEventDecisionStatus.CONFIRMED);
  }

  reject(eventId: string, userId: string): Promise<FamilyEventResponseDto> {
    return this.respond(eventId, userId, FamilyEventDecisionStatus.REJECTED);
  }

  async remove(eventId: string, userId: string): Promise<void> {
    const { familyId } = await this.membership.requirePartner(userId);
    const event = await this.prisma.familyEvent.findFirst({
      where: { id: eventId, familyId, deletedAt: null },
      select: { proposedById: true },
    });
    if (!event) throw new NotFoundException('Family event not found');
    if (event.proposedById !== userId) {
      throw new ForbiddenException('Only the event creator can delete it');
    }

    const result = await this.prisma.familyEvent.updateMany({
      where: { id: eventId, familyId, proposedById: userId, deletedAt: null },
      data: { deletedAt: new Date(), deletedById: userId, version: { increment: 1 } },
    });
    if (result.count !== 1) throw new NotFoundException('Family event not found');
    await this.notifications.notifyFamilyMembers({
      familyId,
      actorId: userId,
      type: 'FAMILY_EVENT_CANCELLED',
      title: 'Семейное событие отменено',
    });
  }

  private async respond(
    eventId: string,
    userId: string,
    status: Exclude<FamilyEventDecisionStatus, 'PROPOSED'>,
  ): Promise<FamilyEventResponseDto> {
    const { familyId, timeZone } = await this.membership.requirePartner(userId);
    const current = await this.prisma.familyEvent.findFirst({
      where: { id: eventId, familyId, deletedAt: null },
    });
    if (!current) throw new NotFoundException('Family event not found');
    if (current.proposedById === userId) {
      throw new ForbiddenException('Only the partner can respond to an event');
    }
    if (current.status !== FamilyEventDecisionStatus.PROPOSED) {
      throw new ConflictException('The event proposal has already been answered');
    }
    if (status === FamilyEventDecisionStatus.CONFIRMED && current.scheduledAt <= new Date()) {
      throw new ConflictException('A past event cannot be confirmed');
    }

    const respondedAt = new Date();
    const result = await this.prisma.familyEvent.updateMany({
      where: {
        id: eventId,
        familyId,
        proposedById: { not: userId },
        status: FamilyEventDecisionStatus.PROPOSED,
        deletedAt: null,
      },
      data: { status, respondedById: userId, respondedAt, version: { increment: 1 } },
    });
    if (result.count !== 1) {
      throw new ConflictException('The event proposal has already been answered');
    }

    const updated = await this.prisma.familyEvent.findFirst({
      where: { id: eventId, familyId, deletedAt: null },
      include: familyEventInclude,
    });
    if (!updated) throw new NotFoundException('Family event not found');
    await this.notifications.notifyUser({
      userId: current.proposedById,
      familyId,
      type:
        status === FamilyEventDecisionStatus.CONFIRMED
          ? 'FAMILY_EVENT_CONFIRMED'
          : 'FAMILY_EVENT_REJECTED',
      title:
        status === FamilyEventDecisionStatus.CONFIRMED
          ? 'Событие подтверждено'
          : 'Событие отклонено',
      body: updated.name,
    });
    return FamilyEventResponseDto.fromEntity(updated, timeZone, respondedAt);
  }
}
