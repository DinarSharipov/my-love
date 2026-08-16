import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BudgetsService } from './budgets.service';

describe('BudgetsService', () => {
  const context = { familyId: 'family-id', role: 'PARTNER' };

  it('creates only an expense-category budget for the first day of a month', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'budget-id',
      limitMinor: 500000n,
      periodStart: new Date('2026-08-01T00:00:00.000Z'),
    });
    const service = new BudgetsService(
      {
        financialCategory: { findFirst: jest.fn().mockResolvedValue({ id: 'category-id' }) },
        $transaction: jest.fn(
          (
            callback: (tx: {
              budget: { create: typeof create };
              auditEvent: { create: jest.Mock };
            }) => unknown,
          ) => callback({ budget: { create }, auditEvent: { create: jest.fn() } }),
        ),
      } as never,
      { requirePartner: jest.fn().mockResolvedValue(context) } as never,
      { record: jest.fn().mockResolvedValue(undefined) } as never,
    );

    const result = await service.create('user-id', {
      categoryId: 'category-id',
      periodStart: '2026-08-01',
      limitMinor: '500000',
    });

    expect(result.limitMinor).toBe('500000');
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('rejects a non-first calendar day before any write', async () => {
    const service = new BudgetsService(
      {} as never,
      { requirePartner: jest.fn().mockResolvedValue(context) } as never,
      {} as never,
    );
    await expect(
      service.create('user-id', {
        categoryId: 'category-id',
        periodStart: '2026-08-02',
        limitMinor: '1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not create a budget for an income or foreign category', async () => {
    const service = new BudgetsService(
      { financialCategory: { findFirst: jest.fn().mockResolvedValue(null) } } as never,
      { requirePartner: jest.fn().mockResolvedValue(context) } as never,
      {} as never,
    );
    await expect(
      service.create('user-id', {
        categoryId: 'category-id',
        periodStart: '2026-08-01',
        limitMinor: '1',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
