import { ForbiddenException } from '@nestjs/common';
import { FinancialMeetingsService } from './financial-meetings.service';

describe('FinancialMeetingsService', () => {
  const creatorId = '00000000-0000-4000-8000-000000000001';
  const partnerId = '00000000-0000-4000-8000-000000000002';
  const familyId = '00000000-0000-4000-8000-000000000003';
  const meetingId = '00000000-0000-4000-8000-000000000004';
  const tx = {
    familyMember: { findFirst: jest.fn().mockResolvedValue({ userId: partnerId }) },
    financialMeeting: {
      create: jest.fn().mockResolvedValue({
        id: meetingId,
        createdById: creatorId,
        title: 'Бюджет сентября',
        scheduledAt: new Date('2099-09-01T18:00:00.000Z'),
        notes: null,
        status: 'SCHEDULED',
        version: 1,
        createdAt: new Date('2099-08-01T00:00:00.000Z'),
        updatedAt: new Date('2099-08-01T00:00:00.000Z'),
        decisions: [],
      }),
      findFirst: jest.fn(),
    },
    financialDecision: { findFirst: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
  };
  const membership = { requirePartner: jest.fn().mockResolvedValue({ familyId }) };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const notifications = { notifyUserInTransaction: jest.fn().mockResolvedValue(undefined) };
  const service = new FinancialMeetingsService(
    prisma as never,
    membership as never,
    audit as never,
    notifications as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('creates a partner-only meeting and notifies the other partner atomically', async () => {
    const result = await service.create(creatorId, {
      title: ' Бюджет сентября ',
      scheduledAt: '2099-09-01T18:00:00.000Z',
    });

    expect(result.title).toBe('Бюджет сентября');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'financial_meeting.created', familyId }),
      tx,
    );
    expect(notifications.notifyUserInTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ userId: partnerId, type: 'FINANCIAL_MEETING_SCHEDULED' }),
    );
  });

  it('does not allow a decision creator to answer their own proposal', async () => {
    tx.financialMeeting.findFirst.mockResolvedValue({ id: meetingId, familyId });
    tx.financialDecision.findFirst.mockResolvedValue({
      id: 'decision',
      meetingId,
      createdById: creatorId,
      status: 'PROPOSED',
      version: 1,
    });

    await expect(service.respond(creatorId, meetingId, 'decision', 'AGREED')).rejects.toThrow(
      ForbiddenException,
    );
  });
});
