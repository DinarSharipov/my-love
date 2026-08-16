import { BadRequestException, Injectable } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { FamilyMembershipService } from '../family-members/family-membership.service';
import { localDateStartUtc } from '../family-events/local-date';
import { CalendarQueryDto } from './dto/calendar-query.dto';
import {
  CalendarEntryKind,
  CalendarEntryResponseDto,
  CalendarProjectionResponseDto,
} from './dto/calendar-response.dto';

const MAX_RANGE_DAYS = 93;
const MAX_ENTRIES = 500;

@Injectable()
export class CalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: FamilyMembershipService,
  ) {}

  async project(userId: string, query: CalendarQueryDto): Promise<CalendarProjectionResponseDto> {
    this.validateRange(query.dateFrom, query.dateTo);
    const context = await this.membership.requireMembership(userId);
    const from = localDateStartUtc(query.dateFrom, context.timeZone);
    const to = localDateStartUtc(query.dateTo, context.timeZone);
    const [events, tasks, reminders] = await this.prisma.$transaction([
      this.prisma.familyEvent.findMany({
        where: {
          familyId: context.familyId,
          deletedAt: null,
          scheduledAt: { gte: from, lt: to },
        },
        select: { id: true, name: true, scheduledAt: true, status: true },
        orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
        take: MAX_ENTRIES + 1,
      }),
      this.prisma.task.findMany({
        where: {
          familyId: context.familyId,
          status: { not: TaskStatus.ARCHIVED },
          dueAt: { gte: from, lt: to },
        },
        select: { id: true, title: true, dueAt: true, status: true, assignedToId: true },
        orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
        take: MAX_ENTRIES + 1,
      }),
      this.prisma.taskReminder.findMany({
        where: {
          userId,
          remindAt: { gte: from, lt: to },
          task: { familyId: context.familyId, status: { not: TaskStatus.ARCHIVED } },
        },
        select: { id: true, remindAt: true, sentAt: true, task: { select: { title: true } } },
        orderBy: [{ remindAt: 'asc' }, { id: 'asc' }],
        take: MAX_ENTRIES + 1,
      }),
    ]);

    const entries: CalendarEntryResponseDto[] = [
      ...events.map((event) => ({
        id: `event:${event.id}`,
        sourceId: event.id,
        kind: CalendarEntryKind.FAMILY_EVENT,
        title: event.name,
        startsAt: event.scheduledAt,
        status: event.status,
        assignedToId: null,
      })),
      ...tasks.map((task) => ({
        id: `task:${task.id}`,
        sourceId: task.id,
        kind: CalendarEntryKind.TASK,
        title: task.title,
        startsAt: task.dueAt as Date,
        status: task.status,
        assignedToId: task.assignedToId,
      })),
      ...reminders.map((reminder) => ({
        id: `task-reminder:${reminder.id}`,
        sourceId: reminder.id,
        kind: CalendarEntryKind.TASK_REMINDER,
        title: reminder.task.title,
        startsAt: reminder.remindAt,
        status: reminder.sentAt ? 'SENT' : 'SCHEDULED',
        assignedToId: userId,
      })),
    ].sort((left, right) =>
      left.startsAt.getTime() === right.startsAt.getTime()
        ? left.id.localeCompare(right.id)
        : left.startsAt.getTime() - right.startsAt.getTime(),
    );

    return {
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      timeZone: context.timeZone,
      data: entries.slice(0, MAX_ENTRIES),
      truncated:
        entries.length > MAX_ENTRIES ||
        events.length > MAX_ENTRIES ||
        tasks.length > MAX_ENTRIES ||
        reminders.length > MAX_ENTRIES,
    };
  }

  private validateRange(dateFrom: string, dateTo: string): void {
    const from = Date.parse(`${dateFrom}T00:00:00.000Z`);
    const to = Date.parse(`${dateTo}T00:00:00.000Z`);
    const days = (to - from) / 86_400_000;
    if (days <= 0 || days > MAX_RANGE_DAYS) {
      throw new BadRequestException(`Calendar range must be between 1 and ${MAX_RANGE_DAYS} days`);
    }
  }
}
