import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { IntimacyCheckIn, IntimacyCheckInPreference, IntimacyMood } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { FamilyMembershipService } from '../family-members/family-membership.service';
import { UpsertIntimacyCheckInDto, UpsertIntimacyEventDto } from './dto/intimacy.dto';

type CheckInWithPreferences = IntimacyCheckIn & { preferences: IntimacyCheckInPreference[] };

const INTERESTING_MOODS = new Set<IntimacyMood>([
  IntimacyMood.SEX,
  IntimacyMood.TENDERNESS,
  IntimacyMood.CLOSENESS,
  IntimacyMood.EXPERIMENT,
]);

function dateValue(value: string, field = 'date'): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException(`${field} must be a valid calendar date`);
  }
  return date;
}

function dateText(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function nextDate(value: Date): Date {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + 1);
  return result;
}

@Injectable()
export class IntimacyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: FamilyMembershipService,
  ) {}

  private async context(userId: string) {
    const current = await this.membership.requirePartner(userId);
    const partner = await this.prisma.familyMember.findFirst({
      where: { familyId: current.familyId, role: 'PARTNER', userId: { not: userId } },
      select: { userId: true },
    });
    return { current, partnerId: partner?.userId ?? null };
  }

  private aggregate(my: CheckInWithPreferences, partner: CheckInWithPreferences) {
    const partnerPreferences = new Set(partner.preferences.map((item) => item.preference));
    return {
      hasMutualInterest:
        my.desireLevel >= 3 &&
        partner.desireLevel >= 3 &&
        INTERESTING_MOODS.has(my.mood) &&
        INTERESTING_MOODS.has(partner.mood),
      matchedPreferences: my.preferences
        .map((item) => item.preference)
        .filter((preference) => partnerPreferences.has(preference)),
    };
  }

  private ownResponse(
    date: string,
    my: CheckInWithPreferences | null,
    partner: CheckInWithPreferences | null,
  ) {
    return {
      date,
      myCheckIn: my
        ? {
            mood: my.mood,
            desireLevel: my.desireLevel,
            preferences: my.preferences.map((item) => item.preference),
          }
        : null,
      partnerHasAnswered: Boolean(partner),
      aggregate: my && partner ? this.aggregate(my, partner) : null,
    };
  }

  async getCheckIn(userId: string, date: string) {
    const parsedDate = dateValue(date);
    const { current, partnerId } = await this.context(userId);
    const records = await this.prisma.intimacyCheckIn.findMany({
      where: {
        familyId: current.familyId,
        date: parsedDate,
        userId: { in: partnerId ? [userId, partnerId] : [userId] },
      },
      include: { preferences: true },
    });
    return this.ownResponse(
      date,
      records.find((item) => item.userId === userId) ?? null,
      records.find((item) => item.userId === partnerId) ?? null,
    );
  }

  async upsertCheckIn(userId: string, date: string, dto: UpsertIntimacyCheckInDto) {
    const parsedDate = dateValue(date);
    const { current } = await this.context(userId);
    const checkIn = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.intimacyCheckIn.findUnique({
        where: { userId_date: { userId, date: parsedDate } },
      });
      if (existing && existing.familyId !== current.familyId)
        throw new NotFoundException('Intimacy check-in not found');
      const saved = existing
        ? await tx.intimacyCheckIn.update({
            where: { id: existing.id },
            data: { mood: dto.mood, desireLevel: dto.desireLevel },
          })
        : await tx.intimacyCheckIn.create({
            data: {
              familyId: current.familyId,
              userId,
              date: parsedDate,
              mood: dto.mood,
              desireLevel: dto.desireLevel,
            },
          });
      await tx.intimacyCheckInPreference.deleteMany({ where: { checkInId: saved.id } });
      if (dto.preferences.length) {
        await tx.intimacyCheckInPreference.createMany({
          data: dto.preferences.map((preference) => ({ checkInId: saved.id, preference })),
        });
      }
      return tx.intimacyCheckIn.findUniqueOrThrow({
        where: { id: saved.id },
        include: { preferences: true },
      });
    });
    const partner = await this.prisma.intimacyCheckIn.findFirst({
      where: { familyId: current.familyId, userId: { not: userId }, date: parsedDate },
      include: { preferences: true },
    });
    return this.ownResponse(date, checkIn, partner);
  }

  async deleteCheckIn(userId: string, date: string) {
    const { current } = await this.context(userId);
    await this.prisma.intimacyCheckIn.deleteMany({
      where: { familyId: current.familyId, userId, date: dateValue(date) },
    });
  }

  async calendar(userId: string, from: string, to: string) {
    const start = dateValue(from, 'from');
    const end = dateValue(to, 'to');
    if (start > end) throw new BadRequestException('from must be before or equal to to');
    const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
    if (days > 366) throw new BadRequestException('The calendar range cannot exceed 366 days');
    const { current, partnerId } = await this.context(userId);
    const userIds = partnerId ? [userId, partnerId] : [userId];
    const [checkIns, events] = await Promise.all([
      this.prisma.intimacyCheckIn.findMany({
        where: {
          familyId: current.familyId,
          userId: { in: userIds },
          date: { gte: start, lte: end },
        },
        include: { preferences: true },
      }),
      this.prisma.intimacyEvent.findMany({
        where: { familyId: current.familyId, date: { gte: start, lte: end } },
      }),
    ]);
    const result: Array<Record<string, unknown>> = [];
    for (let date = start; date <= end; date = nextDate(date)) {
      const day = dateText(date);
      const my = checkIns.find((item) => item.userId === userId && dateText(item.date) === day);
      const partnerCheckIn = checkIns.find(
        (item) => item.userId === partnerId && dateText(item.date) === day,
      );
      result.push({
        date: day,
        myCheckInExists: Boolean(my),
        partnerCheckInExists: Boolean(partnerCheckIn),
        hasMutualInterest:
          my && partnerCheckIn ? this.aggregate(my, partnerCheckIn).hasMutualInterest : null,
        intimacyEventExists: events.some((item) => dateText(item.date) === day),
      });
    }
    return result;
  }

  async upsertEvent(userId: string, date: string, dto: UpsertIntimacyEventDto) {
    const { current } = await this.context(userId);
    return this.prisma.intimacyEvent.upsert({
      where: { familyId_date: { familyId: current.familyId, date: dateValue(date) } },
      create: {
        familyId: current.familyId,
        date: dateValue(date),
        createdByUserId: userId,
        occurred: dto.occurred,
        rating: dto.rating ?? null,
      },
      update: { occurred: dto.occurred, rating: dto.rating ?? null },
    });
  }

  async getEvent(userId: string, date: string) {
    const { current } = await this.context(userId);
    const event = await this.prisma.intimacyEvent.findUnique({
      where: { familyId_date: { familyId: current.familyId, date: dateValue(date) } },
    });
    if (!event) throw new NotFoundException('Intimacy event not found');
    return event;
  }

  async deleteEvent(userId: string, date: string) {
    const { current } = await this.context(userId);
    await this.prisma.intimacyEvent.deleteMany({
      where: { familyId: current.familyId, date: dateValue(date) },
    });
  }
}
