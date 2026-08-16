import { FinancialGoalsService } from './financial-goals.service';

describe('FinancialGoalsService', () => {
  const userId = '00000000-0000-4000-8000-000000000001';
  const familyId = '00000000-0000-4000-8000-000000000002';
  const sourceWalletId = '00000000-0000-4000-8000-000000000003';
  const goalWalletId = '00000000-0000-4000-8000-000000000004';
  const goalId = '00000000-0000-4000-8000-000000000005';
  const goal = {
    id: goalId,
    familyId,
    walletId: goalWalletId,
    createdById: userId,
    title: 'Vacation',
    targetAmountMinor: 500n,
    targetDate: null,
    achievedAt: null,
    version: 1,
    archivedAt: null,
    wallet: {
      id: goalWalletId,
      ownerId: userId,
      type: 'PERSONAL',
      visibility: 'PRIVATE',
      currency: 'RUB',
    },
  };
  const tx = {
    financialGoal: {
      findFirst: jest.fn().mockResolvedValue(goal),
      update: jest.fn().mockResolvedValue({}),
    },
    wallet: {
      findFirst: jest.fn().mockResolvedValue({
        id: sourceWalletId,
        ownerId: userId,
        type: 'PERSONAL',
        visibility: 'PRIVATE',
        currency: 'RUB',
      }),
    },
    ledgerTransaction: {
      create: jest
        .fn()
        .mockResolvedValue({ id: 'transaction', occurredAt: new Date('2026-08-17T12:00:00Z') }),
    },
    financialGoalContribution: { create: jest.fn().mockResolvedValue({ id: 'contribution' }) },
    financialCommandResult: { create: jest.fn().mockResolvedValue({}) },
    ledgerEntry: { aggregate: jest.fn().mockResolvedValue({ _sum: { amountMinor: 500n } }) },
    user: { findFirst: jest.fn().mockResolvedValue(null) },
    notification: { create: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    financialCommandResult: { findUnique: jest.fn().mockResolvedValue(null) },
  };
  const membership = {
    requireMembership: jest
      .fn()
      .mockResolvedValue({ familyId, role: 'PARTNER', defaultCurrency: 'RUB' }),
  };
  const service = new FinancialGoalsService(
    prisma as never,
    membership as never,
    {} as never,
    {} as never,
    { record: jest.fn().mockResolvedValue(undefined) } as never,
    { notifyUserInTransaction: jest.fn().mockResolvedValue(undefined) } as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('creates a balanced transfer contribution and marks the goal achieved', async () => {
    const result = await service.contribute(userId, goalId, 'goal-key-123', {
      fromWalletId: sourceWalletId,
      amountMinor: '500',
    });
    expect(tx.ledgerTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        // Jest asymmetric matchers intentionally erase the nested Prisma input type.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          entries: {
            create: [
              { walletId: sourceWalletId, amountMinor: -500n },
              { walletId: goalWalletId, amountMinor: 500n },
            ],
          },
        }),
      }),
    );
    expect(tx.financialGoal.update).toHaveBeenCalledWith({
      where: { id: goalId },
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: { achievedAt: expect.any(Date) },
    });
    expect(result.currentAmountMinor).toBe('500');
    expect(result.achievedAt).toEqual(expect.any(Date));
  });

  it('does not allow a private wallet to fund a family envelope', async () => {
    tx.financialGoal.findFirst.mockResolvedValueOnce({
      ...goal,
      wallet: { ...goal.wallet, ownerId: null, type: 'FAMILY', visibility: 'FAMILY' },
    });
    await expect(
      service.contribute(userId, goalId, 'goal-key-456', {
        fromWalletId: sourceWalletId,
        amountMinor: '1',
      }),
    ).rejects.toThrow('private wallet cannot fund a family envelope');
    expect(tx.ledgerTransaction.create).not.toHaveBeenCalled();
  });
});
