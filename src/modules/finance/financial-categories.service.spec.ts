import { NotFoundException } from '@nestjs/common';
import { FamilyMemberRole, FinancialCategoryKind } from '@prisma/client';
import { FinancialCategoriesService } from './financial-categories.service';

describe('FinancialCategoriesService', () => {
  it('allows every active family member to create a category', async () => {
    const category = { id: 'category-id', kind: FinancialCategoryKind.EXPENSE };
    const tx = { financialCategory: { create: jest.fn().mockResolvedValue(category) } };
    const service = new FinancialCategoriesService(
      {
        $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
      } as unknown as never,
      {
        requireMembership: jest
          .fn()
          .mockResolvedValue({ familyId: 'family-id', role: FamilyMemberRole.CHILD }),
      } as never,
      { record: jest.fn() } as never,
    );

    await expect(
      service.create('member-id', {
        name: 'Карманные расходы',
        kind: FinancialCategoryKind.EXPENSE,
      }),
    ).resolves.toEqual(category);
    expect(tx.financialCategory.create).toHaveBeenCalledTimes(1);
  });

  it('does not allow a different non-partner member to change a category', async () => {
    const service = new FinancialCategoriesService(
      {
        financialCategory: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ id: 'category-id', createdById: 'another-user' }),
        },
      } as never,
      {
        requireMembership: jest
          .fn()
          .mockResolvedValue({ familyId: 'family-id', role: FamilyMemberRole.CHILD }),
      } as never,
      {} as never,
    );

    await expect(
      service.update('member-id', 'category-id', { name: 'Новое' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
