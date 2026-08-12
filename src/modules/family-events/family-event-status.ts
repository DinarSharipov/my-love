import { FamilyEventDecisionStatus } from '@prisma/client';

export enum FamilyEventStatus {
  PROPOSED = 'PROPOSED',
  CONFIRMED = 'CONFIRMED',
  REJECTED = 'REJECTED',
  EVENT_DAY = 'EVENT_DAY',
  COMPLETED = 'COMPLETED',
}

function localDateKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function resolveFamilyEventStatus(
  decisionStatus: FamilyEventDecisionStatus,
  scheduledAt: Date,
  now: Date,
  timeZone: string,
): FamilyEventStatus {
  if (decisionStatus === FamilyEventDecisionStatus.PROPOSED) {
    return FamilyEventStatus.PROPOSED;
  }
  if (decisionStatus === FamilyEventDecisionStatus.REJECTED) {
    return FamilyEventStatus.REJECTED;
  }

  const eventDay = localDateKey(scheduledAt, timeZone);
  const currentDay = localDateKey(now, timeZone);
  if (eventDay === currentDay) return FamilyEventStatus.EVENT_DAY;
  if (eventDay < currentDay) return FamilyEventStatus.COMPLETED;
  return FamilyEventStatus.CONFIRMED;
}
