import { FamilyEventDecisionStatus } from '@prisma/client';
import { FamilyEventStatus, resolveFamilyEventStatus } from './family-event-status';

describe('resolveFamilyEventStatus', () => {
  const timeZone = 'Europe/Moscow';

  it.each([
    [FamilyEventDecisionStatus.PROPOSED, FamilyEventStatus.PROPOSED],
    [FamilyEventDecisionStatus.REJECTED, FamilyEventStatus.REJECTED],
  ])('keeps %s unaffected by the calendar date', (decision, expected) => {
    expect(
      resolveFamilyEventStatus(
        decision,
        new Date('2026-08-10T12:00:00.000Z'),
        new Date('2026-08-12T12:00:00.000Z'),
        timeZone,
      ),
    ).toBe(expected);
  });

  it('returns CONFIRMED before the event day', () => {
    expect(
      resolveFamilyEventStatus(
        FamilyEventDecisionStatus.CONFIRMED,
        new Date('2026-08-13T00:00:00.000Z'),
        new Date('2026-08-12T20:59:59.000Z'),
        timeZone,
      ),
    ).toBe(FamilyEventStatus.CONFIRMED);
  });

  it('returns EVENT_DAY using the configured timezone', () => {
    expect(
      resolveFamilyEventStatus(
        FamilyEventDecisionStatus.CONFIRMED,
        new Date('2026-08-13T18:00:00.000Z'),
        new Date('2026-08-12T21:00:00.000Z'),
        timeZone,
      ),
    ).toBe(FamilyEventStatus.EVENT_DAY);
  });

  it('returns COMPLETED after the local event day', () => {
    expect(
      resolveFamilyEventStatus(
        FamilyEventDecisionStatus.CONFIRMED,
        new Date('2026-08-12T18:00:00.000Z'),
        new Date('2026-08-12T21:00:00.000Z'),
        timeZone,
      ),
    ).toBe(FamilyEventStatus.COMPLETED);
  });
});
