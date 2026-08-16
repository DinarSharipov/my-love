import { RecurringPaymentsService } from './recurring-payments.service';

describe('RecurringPaymentsService', () => {
  const userId = '00000000-0000-4000-8000-000000000001';
  const walletId = '00000000-0000-4000-8000-000000000002';
  const categoryId = '00000000-0000-4000-8000-000000000003';
  const familyId = '00000000-0000-4000-8000-000000000004';
  const tx = {
    wallet: {
      findFirst: jest.fn().mockResolvedValue({
        id: walletId,
        ownerId: userId,
        type: 'PERSONAL',
        visibility: 'PRIVATE',
      }),
    },
    financialCategory: {
      findFirst: jest.fn().mockResolvedValue({ id: categoryId, kind: 'EXPENSE' }),
    },
    familyMember: { findMany: jest.fn().mockResolvedValue([{ userId, role: 'PARTNER' }]) },
    recurringPayment: {
      create: jest.fn().mockResolvedValue({
        id: 'payment',
        walletId,
        categoryId,
        type: 'EXPENSE',
        title: 'Internet',
        note: null,
        amountMinor: 500n,
        frequency: 'MONTHLY',
        interval: 1,
        nextDueAt: new Date('2026-09-01T12:00:00Z'),
        reminderOffsetMinutes: 60,
        reminderRecipientIds: [userId],
        active: true,
        version: 1,
      }),
    },
    recurringPaymentForecast: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
  };
  const membership = {
    requireMembership: jest.fn().mockResolvedValue({ familyId, role: 'PARTNER' }),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new RecurringPaymentsService(
    prisma as never,
    membership as never,
    {} as never,
    audit as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('creates the first forecast with a reminder offset and serializes minor units', async () => {
    const result = await service.create(userId, {
      walletId,
      categoryId,
      type: 'EXPENSE',
      title: 'Internet',
      amountMinor: '500',
      frequency: 'MONTHLY',
      nextDueAt: '2026-09-01T12:00:00.000Z',
      reminderOffsetMinutes: 60,
    } as never);
    expect(result.amountMinor).toBe('500');
    expect(tx.recurringPaymentForecast.create).toHaveBeenCalledTimes(1);
  });

  it('rejects a category whose kind does not match the operation', async () => {
    tx.financialCategory.findFirst.mockResolvedValueOnce({ id: categoryId, kind: 'INCOME' });
    await expect(
      service.create(userId, {
        walletId,
        categoryId,
        type: 'EXPENSE',
        title: 'Internet',
        amountMinor: '500',
        frequency: 'MONTHLY',
        nextDueAt: '2026-09-01T12:00:00.000Z',
      } as never),
    ).rejects.toThrow('Financial category not found');
  });
});
