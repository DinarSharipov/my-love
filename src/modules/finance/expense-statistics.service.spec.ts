import { BadRequestException } from '@nestjs/common';
import { LedgerTransactionType } from '@prisma/client';
import { ExpenseStatisticsService } from './expense-statistics.service';

describe('ExpenseStatisticsService', () => {
  const familyId = 'family-id';
  const userId = 'partner-id';

  it('aggregates all family expenses by original author and category, including reversals', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        type: LedgerTransactionType.EXPENSE,
        currency: 'RUB',
        categoryId: 'food',
        createdById: 'member-a',
        entries: [
          { walletId: 'wallet-a', amountMinor: -100n },
          { walletId: null, amountMinor: 100n },
        ],
        category: { name: 'Продукты' },
        createdBy: { firstName: 'Анна', lastName: 'Иванова' },
        reverses: null,
      },
      {
        type: LedgerTransactionType.REVERSAL,
        currency: 'RUB',
        categoryId: 'food',
        createdById: 'member-b',
        entries: [
          { walletId: 'wallet-a', amountMinor: 30n },
          { walletId: null, amountMinor: -30n },
        ],
        category: { name: 'Продукты' },
        createdBy: { firstName: 'Борис', lastName: 'Петров' },
        reverses: {
          type: LedgerTransactionType.EXPENSE,
          createdById: 'member-a',
          categoryId: 'food',
          category: { name: 'Продукты' },
        },
      },
      {
        type: LedgerTransactionType.REVERSAL,
        currency: 'RUB',
        categoryId: null,
        createdById: 'member-b',
        entries: [
          { walletId: 'wallet-b', amountMinor: -50n },
          { walletId: null, amountMinor: 50n },
        ],
        category: null,
        createdBy: { firstName: 'Борис', lastName: 'Петров' },
        reverses: {
          type: LedgerTransactionType.INCOME,
          createdById: 'member-b',
          categoryId: null,
          category: null,
        },
      },
    ]);
    const service = new ExpenseStatisticsService(
      { ledgerTransaction: { findMany } } as never,
      { requirePartner: jest.fn().mockResolvedValue({ familyId }) } as never,
    );

    await expect(
      service.get(userId, { dateFrom: '2026-01-01', dateTo: '2026-01-31' }),
    ).resolves.toEqual({
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
      totals: [{ currency: 'RUB', amountMinor: '70' }],
      members: [
        {
          userId: 'member-a',
          firstName: 'Анна',
          lastName: 'Иванова',
          totals: [{ currency: 'RUB', amountMinor: '70' }],
          categories: [
            {
              categoryId: 'food',
              name: 'Продукты',
              totals: [{ currency: 'RUB', amountMinor: '70' }],
            },
          ],
        },
      ],
    });
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it('rejects an inverted range before querying transactions', async () => {
    const findMany = jest.fn();
    const service = new ExpenseStatisticsService(
      { ledgerTransaction: { findMany } } as never,
      { requirePartner: jest.fn().mockResolvedValue({ familyId }) } as never,
    );

    await expect(
      service.get(userId, { dateFrom: '2026-02-01', dateTo: '2026-01-31' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(findMany).not.toHaveBeenCalled();
  });
});
