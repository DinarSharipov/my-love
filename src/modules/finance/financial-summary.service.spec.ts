import { FinancialSummaryService } from './financial-summary.service';

describe('FinancialSummaryService', () => {
  it('builds a signed actual total and budget remainder from visible immutable entries', async () => {
    const findMany = jest
      .fn()
      .mockResolvedValueOnce([{ id: 'food', name: 'Food', kind: 'EXPENSE', archivedAt: null }])
      .mockResolvedValueOnce([{ id: 'budget', categoryId: 'food', limitMinor: 500n, version: 2 }])
      .mockResolvedValueOnce([
        {
          categoryId: 'food',
          currency: 'RUB',
          entries: [
            { walletId: 'wallet', amountMinor: -200n },
            { walletId: null, amountMinor: 200n },
          ],
        },
        {
          categoryId: 'food',
          currency: 'RUB',
          entries: [
            { walletId: 'wallet', amountMinor: 50n },
            { walletId: null, amountMinor: -50n },
          ],
        },
      ]);
    const service = new FinancialSummaryService(
      {
        financialCategory: { findMany },
        budget: { findMany },
        ledgerTransaction: { findMany },
        $transaction: jest.fn((operations: unknown[]) => Promise.all(operations)),
      } as never,
      {
        requireMembership: jest.fn().mockResolvedValue({
          familyId: 'family-id',
          role: 'PARTNER',
          defaultCurrency: 'RUB',
        }),
      } as never,
      { visibleWhere: jest.fn().mockResolvedValue({ familyId: 'family-id' }) } as never,
    );

    const result = await service.get('user-id', { periodStart: '2026-08-01' });

    expect(result.categories[0]).toMatchObject({
      actual: [{ currency: 'RUB', amountMinor: '150' }],
      budget: { limitMinor: '500', actualMinor: '150', remainingMinor: '350' },
    });
  });

  it('does not ask Prisma for transactions outside the shared visibility predicate', async () => {
    const ledgerFindMany = jest.fn().mockResolvedValue([]);
    const visibleWhere = jest.fn().mockResolvedValue({
      familyId: 'family-id',
      entries: { none: { walletId: { notIn: ['private-wallet'] } } },
    });
    const service = new FinancialSummaryService(
      {
        financialCategory: { findMany: jest.fn().mockResolvedValue([]) },
        budget: { findMany: jest.fn().mockResolvedValue([]) },
        ledgerTransaction: { findMany: ledgerFindMany },
        $transaction: jest.fn((operations: unknown[]) => Promise.all(operations)),
      } as never,
      {
        requireMembership: jest.fn().mockResolvedValue({
          familyId: 'family-id',
          role: 'PARTNER',
          defaultCurrency: 'RUB',
        }),
      } as never,
      { visibleWhere } as never,
    );

    await service.get('user-id', { periodStart: '2026-08-01' });

    expect(visibleWhere).toHaveBeenCalledWith('user-id', 'family-id', 'PARTNER');
    expect(ledgerFindMany).toHaveBeenCalledTimes(1);
  });
});
