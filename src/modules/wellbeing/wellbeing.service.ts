import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FamilyMembershipService } from '../family-members/family-membership.service';
import { CreateWellbeingCheckInDto } from './dto/wellbeing-check-in.dto';
import { CreateWellbeingConsentDto, WELLBEING_SCOPES } from './dto/wellbeing-consent.dto';
import { CreateWellbeingAssessmentDto } from './dto/wellbeing-assessment.dto';
import { CreateWellbeingGratitudeDto } from './dto/wellbeing-gratitude.dto';
import { NotificationProducerService } from '../../common/notifications/notification-producer.service';
import {
  CreateWellbeingSupportRequestDto,
  UpdateWellbeingSupportRequestDto,
} from './dto/wellbeing-support-request.dto';
import { CreateWellbeingRitualDto, UpdateWellbeingRitualDto } from './dto/wellbeing-ritual.dto';
import {
  CreateWellbeingCoupleMeetingDto,
  UpdateWellbeingCoupleMeetingDto,
} from './dto/wellbeing-couple-meeting.dto';
import {
  WellbeingCoupleMeetingDecisionDto,
  WellbeingCoupleMeetingResponseInputDto,
} from './dto/wellbeing-couple-meeting.dto';

@Injectable()
export class WellbeingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: FamilyMembershipService,
    private readonly notifications: NotificationProducerService,
  ) {}

  async create(userId: string, dto: CreateWellbeingCheckInDto) {
    const { familyId } = await this.membership.requireMembership(userId);
    return this.prisma.wellbeingCheckIn.create({
      data: {
        familyId,
        ownerId: userId,
        mood: dto.mood,
        energy: dto.energy,
        stress: dto.stress,
        note: dto.note ?? null,
        supportRequest: dto.supportRequest ?? false,
      },
    });
  }

  async list(userId: string) {
    await this.membership.requireMembership(userId);
    return this.prisma.wellbeingCheckIn.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    await this.membership.requireMembership(userId);
    const result = await this.prisma.wellbeingCheckIn.findFirst({ where: { id, ownerId: userId } });
    if (!result) throw new NotFoundException('The wellbeing check-in does not exist');
    return result;
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.findOne(userId, id);
    await this.prisma.wellbeingCheckIn.delete({ where: { id } });
  }

  async grantConsent(userId: string, dto: CreateWellbeingConsentDto) {
    const { familyId } = await this.membership.requireMembership(userId);
    if (dto.recipientId === userId || dto.scopes.length === 0) {
      throw new BadRequestException('A partner and at least one wellbeing scope are required');
    }
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (expiresAt && expiresAt <= new Date()) {
      throw new BadRequestException('Wellbeing consent expiry must be in the future');
    }
    const recipient = await this.prisma.familyMember.findFirst({
      where: { familyId, userId: dto.recipientId, role: 'PARTNER' },
    });
    if (!recipient) throw new NotFoundException('The partner does not exist in this family');
    return this.prisma.wellbeingConsentGrant.upsert({
      where: { ownerId_recipientId: { ownerId: userId, recipientId: dto.recipientId } },
      create: {
        familyId,
        ownerId: userId,
        recipientId: dto.recipientId,
        scopes: dto.scopes,
        expiresAt,
        revokedAt: null,
      },
      update: {
        familyId,
        scopes: dto.scopes,
        expiresAt,
        revokedAt: null,
      },
    });
  }

  async listConsents(userId: string) {
    const { familyId } = await this.membership.requireMembership(userId);
    return this.prisma.wellbeingConsentGrant.findMany({
      where: { familyId, ownerId: userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeConsent(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.wellbeingConsentGrant.updateMany({
      where: { id, ownerId: userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (!count) throw new NotFoundException('The wellbeing consent does not exist');
  }

  async sharedWithMe(userId: string) {
    const { familyId } = await this.membership.requireMembership(userId);
    const grants = await this.prisma.wellbeingConsentGrant.findMany({
      where: {
        familyId,
        recipientId: userId,
        family: { status: 'ACTIVE' },
        owner: { isActive: true, familyMember: { familyId } },
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: {
        owner: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
    const result = [];
    for (const grant of grants) {
      const rows = await this.prisma.wellbeingCheckIn.findMany({
        where: { ownerId: grant.ownerId, familyId },
        orderBy: { createdAt: 'desc' },
      });
      result.push(
        ...rows.map((row) => ({
          id: row.id,
          ownerId: row.ownerId,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          owner: grant.owner,
          ...Object.fromEntries(
            grant.scopes
              .filter((scope) => WELLBEING_SCOPES.includes(scope as never))
              .map((scope) => [scope, row[scope as keyof typeof row]]),
          ),
        })),
      );
    }
    return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createAssessment(userId: string, dto: CreateWellbeingAssessmentDto) {
    const { familyId } = await this.membership.requireMembership(userId);
    return this.prisma.wellbeingAssessment.create({
      data: {
        familyId,
        ownerId: userId,
        answers: dto.answers,
        score: dto.answers.reduce((sum, answer) => sum + answer, 0),
      },
    });
  }

  async listAssessments(userId: string) {
    await this.membership.requireMembership(userId);
    return this.prisma.wellbeingAssessment.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async trends(userId: string) {
    const [checkIns, assessments] = await Promise.all([
      this.list(userId),
      this.listAssessments(userId),
    ]);
    return {
      checkIns: checkIns.map(({ id, mood, energy, stress, supportRequest, createdAt }) => ({
        id,
        mood,
        energy,
        stress,
        supportRequest,
        createdAt,
      })),
      assessments: assessments.map(({ id, score, createdAt }) => ({ id, score, createdAt })),
    };
  }

  async exportData(userId: string) {
    await this.membership.requireMembership(userId);
    const [checkIns, assessments, gratitudes, supportRequests, rituals, coupleMeetings] =
      await Promise.all([
        this.prisma.wellbeingCheckIn.findMany({
          where: { ownerId: userId },
          orderBy: { createdAt: 'asc' },
        }),
        this.prisma.wellbeingAssessment.findMany({
          where: { ownerId: userId },
          orderBy: { createdAt: 'asc' },
        }),
        this.prisma.wellbeingGratitude.findMany({
          where: { OR: [{ authorId: userId }, { recipientId: userId }] },
          orderBy: { createdAt: 'asc' },
        }),
        this.prisma.wellbeingSupportRequest.findMany({
          where: { OR: [{ requesterId: userId }, { recipientId: userId }] },
          orderBy: { createdAt: 'asc' },
        }),
        this.prisma.wellbeingRitual.findMany({
          where: { createdById: userId },
          orderBy: { createdAt: 'asc' },
        }),
        this.prisma.wellbeingCoupleMeeting.findMany({
          where: { createdById: userId },
          orderBy: { createdAt: 'asc' },
        }),
      ]);
    return { checkIns, assessments, gratitudes, supportRequests, rituals, coupleMeetings };
  }

  async deleteAll(userId: string): Promise<void> {
    await this.membership.requireMembership(userId);
    await this.prisma.$transaction([
      this.prisma.wellbeingConsentGrant.deleteMany({
        where: { OR: [{ ownerId: userId }, { recipientId: userId }] },
      }),
      this.prisma.wellbeingAssessment.deleteMany({ where: { ownerId: userId } }),
      this.prisma.wellbeingCheckIn.deleteMany({ where: { ownerId: userId } }),
      this.prisma.wellbeingGratitude.deleteMany({
        where: { OR: [{ authorId: userId }, { recipientId: userId }] },
      }),
      this.prisma.wellbeingSupportRequest.deleteMany({
        where: { OR: [{ requesterId: userId }, { recipientId: userId }] },
      }),
      this.prisma.wellbeingRitual.deleteMany({ where: { createdById: userId } }),
      this.prisma.wellbeingCoupleMeeting.deleteMany({ where: { createdById: userId } }),
    ]);
  }

  async createGratitude(userId: string, dto: CreateWellbeingGratitudeDto) {
    const { familyId } = await this.membership.requireMembership(userId);
    if (dto.recipientId === userId) throw new BadRequestException('You cannot thank yourself');
    const recipient = await this.prisma.familyMember.findFirst({
      where: { familyId, userId: dto.recipientId, role: 'PARTNER' },
    });
    if (!recipient) throw new NotFoundException('The partner does not exist in this family');
    const gratitude = await this.prisma.wellbeingGratitude.create({
      data: { familyId, authorId: userId, recipientId: dto.recipientId, message: dto.message },
    });
    await this.notifications.notifyUser({
      userId: dto.recipientId,
      familyId,
      type: 'WELLBEING_GRATITUDE_RECEIVED',
      title: 'New gratitude',
      body: 'Your partner sent you a gratitude message.',
    });
    return gratitude;
  }

  async listGratitudes(userId: string) {
    const { familyId } = await this.membership.requireMembership(userId);
    return this.prisma.wellbeingGratitude.findMany({
      where: { familyId, OR: [{ authorId: userId }, { recipientId: userId }] },
      orderBy: { createdAt: 'desc' },
    });
  }

  async removeGratitude(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.wellbeingGratitude.deleteMany({
      where: { id, authorId: userId },
    });
    if (!count) throw new NotFoundException('The wellbeing gratitude does not exist');
  }

  async createSupportRequest(userId: string, dto: CreateWellbeingSupportRequestDto) {
    const { familyId } = await this.membership.requireMembership(userId);
    if (dto.recipientId === userId)
      throw new BadRequestException('You cannot request support from yourself');
    const recipient = await this.prisma.familyMember.findFirst({
      where: { familyId, userId: dto.recipientId, role: 'PARTNER' },
    });
    if (!recipient) throw new NotFoundException('The partner does not exist in this family');
    const request = await this.prisma.wellbeingSupportRequest.create({
      data: {
        familyId,
        requesterId: userId,
        recipientId: dto.recipientId,
        message: dto.message ?? null,
      },
    });
    await this.notifications.notifyUser({
      userId: dto.recipientId,
      familyId,
      type: 'WELLBEING_SUPPORT_REQUESTED',
      title: 'Your partner requested support',
      body: 'Your partner asked for support.',
    });
    return request;
  }

  async listSupportRequests(userId: string) {
    const { familyId } = await this.membership.requireMembership(userId);
    return this.prisma.wellbeingSupportRequest.findMany({
      where: { familyId, OR: [{ requesterId: userId }, { recipientId: userId }] },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateSupportRequest(userId: string, id: string, dto: UpdateWellbeingSupportRequestDto) {
    const { count } = await this.prisma.wellbeingSupportRequest.updateMany({
      where: { id, recipientId: userId },
      data: { status: dto.status },
    });
    if (!count) throw new NotFoundException('The wellbeing support request does not exist');
    return this.prisma.wellbeingSupportRequest.findUniqueOrThrow({ where: { id } });
  }

  async createRitual(userId: string, dto: CreateWellbeingRitualDto) {
    const { familyId } = await this.membership.requireMembership(userId);
    return this.prisma.wellbeingRitual.create({
      data: {
        familyId,
        createdById: userId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        cadence: dto.cadence.trim(),
        nextAt: new Date(dto.nextAt),
      },
    });
  }

  async listRituals(userId: string) {
    const { familyId } = await this.membership.requireMembership(userId);
    return this.prisma.wellbeingRitual.findMany({
      where: { familyId },
      orderBy: { nextAt: 'asc' },
    });
  }

  async updateRitual(userId: string, id: string, dto: UpdateWellbeingRitualDto) {
    const { familyId } = await this.membership.requireMembership(userId);
    const result = await this.prisma.wellbeingRitual.updateMany({
      where: { id, familyId, createdById: userId },
      data: {
        title: dto.title?.trim(),
        description: dto.description === undefined ? undefined : dto.description.trim() || null,
        cadence: dto.cadence?.trim(),
        nextAt: dto.nextAt ? new Date(dto.nextAt) : undefined,
        isActive: dto.isActive,
      },
    });
    if (!result.count) throw new NotFoundException('The wellbeing ritual does not exist');
    return this.prisma.wellbeingRitual.findUniqueOrThrow({ where: { id } });
  }

  async removeRitual(userId: string, id: string): Promise<void> {
    const { familyId } = await this.membership.requireMembership(userId);
    const result = await this.prisma.wellbeingRitual.deleteMany({
      where: { id, familyId, createdById: userId },
    });
    if (!result.count) throw new NotFoundException('The wellbeing ritual does not exist');
  }

  async createCoupleMeeting(userId: string, dto: CreateWellbeingCoupleMeetingDto) {
    const { familyId } = await this.membership.requirePartner(userId);
    const scheduledAt = new Date(dto.scheduledAt);
    if (scheduledAt <= new Date())
      throw new BadRequestException('Meeting date must be in the future');
    return this.prisma.wellbeingCoupleMeeting.create({
      data: {
        familyId,
        createdById: userId,
        title: dto.title.trim(),
        scheduledAt,
        sections: dto.sections.map((section) => section.trim()),
      },
    });
  }

  async listCoupleMeetings(userId: string) {
    const { familyId } = await this.membership.requirePartner(userId);
    return this.prisma.wellbeingCoupleMeeting.findMany({
      where: { familyId },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async updateCoupleMeeting(userId: string, id: string, dto: UpdateWellbeingCoupleMeetingDto) {
    const { familyId } = await this.membership.requirePartner(userId);
    const current = await this.prisma.wellbeingCoupleMeeting.findFirst({ where: { id, familyId } });
    if (!current) throw new NotFoundException('The wellbeing couple meeting does not exist');
    if (current.createdById !== userId)
      throw new ForbiddenException('Only the meeting creator can update it');
    if (current.publishedAt) throw new ConflictException('A published meeting cannot be updated');
    return this.prisma.wellbeingCoupleMeeting.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        sections: dto.sections ? dto.sections.map((section) => section.trim()) : undefined,
      },
    });
  }

  async respondToCoupleMeeting(
    userId: string,
    id: string,
    dto: WellbeingCoupleMeetingResponseInputDto,
  ) {
    const { familyId } = await this.membership.requirePartner(userId);
    const meeting = await this.prisma.wellbeingCoupleMeeting.findFirst({ where: { id, familyId } });
    if (!meeting) throw new NotFoundException('The wellbeing couple meeting does not exist');
    if (meeting.publishedAt)
      throw new ConflictException('Meeting responses have already been published');
    const responses = {
      ...(meeting.responses as Record<string, string>),
      [userId]: dto.response.trim(),
    };
    return this.prisma.wellbeingCoupleMeeting.update({
      where: { id },
      data: { responses },
    });
  }

  async publishCoupleMeeting(userId: string, id: string) {
    const { familyId } = await this.membership.requirePartner(userId);
    const meeting = await this.prisma.wellbeingCoupleMeeting.findFirst({ where: { id, familyId } });
    if (!meeting) throw new NotFoundException('The wellbeing couple meeting does not exist');
    if (meeting.createdById !== userId)
      throw new ForbiddenException('Only the meeting creator can publish it');
    if (meeting.publishedAt)
      throw new ConflictException('Meeting responses have already been published');
    return this.prisma.wellbeingCoupleMeeting.update({
      where: { id },
      data: { publishedAt: new Date() },
    });
  }

  async setCoupleMeetingDecision(
    userId: string,
    id: string,
    dto: WellbeingCoupleMeetingDecisionDto,
  ) {
    const { familyId } = await this.membership.requirePartner(userId);
    const meeting = await this.prisma.wellbeingCoupleMeeting.findFirst({ where: { id, familyId } });
    if (!meeting) throw new NotFoundException('The wellbeing couple meeting does not exist');
    if (!meeting.publishedAt)
      throw new ConflictException('Publish meeting responses before setting a decision');
    return this.prisma.wellbeingCoupleMeeting.update({
      where: { id },
      data: { sharedDecision: dto.decision.trim() },
    });
  }
}
