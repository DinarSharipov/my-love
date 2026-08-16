import { FinancialAnalyticsService } from './financial-analytics.service';

describe('FinancialAnalyticsService', () => {
  it('combines visible actual cash flow, planned recurring payments and balance forecast', async () => {
    const service = new FinancialAnalyticsService(
      {
        ledgerTransaction: {
          findMany: jest.fn().mockResolvedValue([
            {
              occurredAt: new Date('2026-08-05T12:00:00.000Z'),
              currency: 'RUB',
              entries: [
                { walletId: 'wallet', amountMinor: 1_000n },
                { walletId: null, amountMinor: -1_000n },
              ],
            },
            {
              occurredAt: new Date('2026-08-07T12:00:00.000Z'),
              currency: 'RUB',
              entries: [
                { walletId: 'wallet', amountMinor: -300n },
                { walletId: null, amountMinor: 300n },
              ],
            },
          ]),
        },
        recurringPayment: {
          findMany: jest.fn().mockResolvedValue([
            {
              type: 'EXPENSE',
              amountMinor: 200n,
              frequency: 'MONTHLY',
              interval: 1,
              nextDueAt: new Date('2026-08-20T12:00:00.000Z'),
              wallet: { currency: 'RUB' },
            },
          ]),
        },
        ledgerEntry: {
          findMany: jest
            .fn()
            .mockResolvedValue([
              { walletId: 'wallet', amountMinor: 700n, wallet: { currency: 'RUB' } },
            ]),
        },
        $transaction: jest.fn((operations: unknown[]) => Promise.all(operations)),
      } as never,
      {
        requireMembership: jest.fn().mockResolvedValue({
          familyId: 'family-id',
          role: 'PARTNER',
        }),
      } as never,
      { visibleWhere: jest.fn().mockResolvedValue({ familyId: 'family-id' }) } as never,
      { visibleTo: jest.fn().mockReturnValue({ visibility: { in: ['FAMILY'] } }) } as never,
    );

    const result = await service.get(
      'user-id',
      { periodStart: '2026-08-01', months: 2, forecastDays: 30 },
      new Date('2026-08-17T00:00:00.000Z'),
    );

    expect(result.cashFlow[0]).toEqual({
      periodStart: '2026-08-01',
      actual: [{ currency: 'RUB', incomeMinor: '1000', expenseMinor: '300', netMinor: '700' }],
      mandatory: [{ currency: 'RUB', incomeMinor: '0', expenseMinor: '200', netMinor: '-200' }],
    });
    expect(result.balanceForecast).toEqual([
      {
        currency: 'RUB',
        currentBalanceMinor: '700',
        plannedIncomeMinor: '0',
        plannedExpenseMinor: '200',
        projectedBalanceMinor: '500',
      },
    ]);
  });

  it('applies the ledger visibility predicate to both cash flow and balance queries', async () => {
    const transactionCalls: unknown[] = [];
    const entryCalls: unknown[] = [];
    const transactions = {
      findMany: jest.fn((query: unknown) => {
        transactionCalls.push(query);
        return Promise.resolve([]);
      }),
    };
    const entries = {
      findMany: jest.fn((query: unknown) => {
        entryCalls.push(query);
        return Promise.resolve([]);
      }),
    };
    const visibleWhere = jest.fn().mockResolvedValue({
      familyId: 'family-id',
      entries: { none: { walletId: { notIn: ['private-wallet'] } } },
    });
    const service = new FinancialAnalyticsService(
      {
        ledgerTransaction: transactions,
        recurringPayment: { findMany: jest.fn().mockResolvedValue([]) },
        ledgerEntry: entries,
        $transaction: jest.fn((operations: unknown[]) => Promise.all(operations)),
      } as never,
      {
        requireMembership: jest.fn().mockResolvedValue({ familyId: 'family-id', role: 'PARTNER' }),
      } as never,
      { visibleWhere } as never,
      { visibleTo: jest.fn().mockReturnValue({}) } as never,
    );

    await service.get('user-id', { periodStart: '2026-08-01' });

    expect(visibleWhere).toHaveBeenCalledWith('user-id', 'family-id', 'PARTNER');
    expect(transactionCalls[0]).toMatchObject({
      where: {
        entries: { none: { walletId: { notIn: ['private-wallet'] } } },
      },
    });
    expect(entryCalls[0]).toMatchObject({
      where: { transaction: { familyId: 'family-id' } },
    });
  });
});
