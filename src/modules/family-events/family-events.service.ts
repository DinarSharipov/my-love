import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FamilyEventDecisionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateFamilyEventDto } from './dto/create-family-event.dto';
import { familyEventInclude, FamilyEventResponseDto } from './dto/family-event-response.dto';
import { FamilyEventsQueryDto } from './dto/family-events-query.dto';
import { PaginatedFamilyEventsResponseDto } from './dto/paginated-family-events-response.dto';
import { localDateStartUtc } from './local-date';

@Injectable()
export class FamilyEventsService {
  private readonly timeZone: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.timeZone = config.getOrThrow<string>('APP_TIMEZONE');
  }

  async create(userId: string, dto: CreateFamilyEventDto): Promise<FamilyEventResponseDto> {
    const familyId = await this.getFamilyId(userId);
    const scheduledAt = new Date(dto.scheduledAt);
    if (scheduledAt.getTime() <= Date.now()) {
      throw new BadRequestException('Event date must be in the future');
    }

    const familyMembers = await this.prisma.familyMember.count({ where: { familyId } });
    if (familyMembers !== 2) {
      throw new ConflictException('A family must have exactly two members to plan an event');
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
    return FamilyEventResponseDto.fromEntity(event, this.timeZone);
  }

  async findAll(
    userId: string,
    query: FamilyEventsQueryDto,
  ): Promise<PaginatedFamilyEventsResponseDto> {
    const familyId = await this.getFamilyId(userId);
    const dateFrom = query.dateFrom ? localDateStartUtc(query.dateFrom, this.timeZone) : undefined;
    const dateTo = query.dateTo ? localDateStartUtc(query.dateTo, this.timeZone) : undefined;
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
      data: events.map((event) => FamilyEventResponseDto.fromEntity(event, this.timeZone, now)),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async findOne(eventId: string, userId: string): Promise<FamilyEventResponseDto> {
    const familyId = await this.getFamilyId(userId);
    const event = await this.prisma.familyEvent.findFirst({
      where: { id: eventId, familyId, deletedAt: null },
      include: familyEventInclude,
    });
    if (!event) throw new NotFoundException('Family event not found');
    return FamilyEventResponseDto.fromEntity(event, this.timeZone);
  }

  confirm(eventId: string, userId: string): Promise<FamilyEventResponseDto> {
    return this.respond(eventId, userId, FamilyEventDecisionStatus.CONFIRMED);
  }

  reject(eventId: string, userId: string): Promise<FamilyEventResponseDto> {
    return this.respond(eventId, userId, FamilyEventDecisionStatus.REJECTED);
  }

  async remove(eventId: string, userId: string): Promise<void> {
    const familyId = await this.getFamilyId(userId);
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
      data: { deletedAt: new Date(), deletedById: userId },
    });
    if (result.count !== 1) throw new NotFoundException('Family event not found');
  }

  private async respond(
    eventId: string,
    userId: string,
    status: Exclude<FamilyEventDecisionStatus, 'PROPOSED'>,
  ): Promise<FamilyEventResponseDto> {
    const familyId = await this.getFamilyId(userId);
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
      data: { status, respondedById: userId, respondedAt },
    });
    if (result.count !== 1) {
      throw new ConflictException('The event proposal has already been answered');
    }

    const updated = await this.prisma.familyEvent.findFirst({
      where: { id: eventId, familyId, deletedAt: null },
      include: familyEventInclude,
    });
    if (!updated) throw new NotFoundException('Family event not found');
    return FamilyEventResponseDto.fromEntity(updated, this.timeZone, respondedAt);
  }

  private async getFamilyId(userId: string): Promise<string> {
    const membership = await this.prisma.familyMember.findUnique({
      where: { userId },
      select: { familyId: true },
    });
    if (!membership) {
      throw new ForbiddenException('Only family members can access family events');
    }
    return membership.familyId;
  }
}
