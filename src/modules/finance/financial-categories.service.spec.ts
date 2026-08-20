import { ConflictException, NotFoundException } from '@nestjs/common';
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

  it('restores an archived category with ownership and version checks', async () => {
    const archived = { id: 'category-id', createdById: 'member-id', version: 2 };
    const restored = { ...archived, archivedAt: null, version: 3 };
    const tx = {
      financialCategory: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(restored),
      },
    };
    const service = new FinancialCategoriesService(
      {
        financialCategory: { findFirst: jest.fn().mockResolvedValue(archived) },
        $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
      } as never,
      {
        requireMembership: jest
          .fn()
          .mockResolvedValue({ familyId: 'family-id', role: FamilyMemberRole.CHILD }),
      } as never,
      { record: jest.fn() } as never,
    );

    await expect(service.restore('member-id', 'category-id', 2)).resolves.toEqual(restored);
    expect(tx.financialCategory.updateMany).toHaveBeenCalledWith({
      where: { id: 'category-id', version: 2, archivedAt: { not: null } },
      data: { archivedAt: null, version: { increment: 1 } },
    });
  });

  it('rejects a concurrent category restore', async () => {
    const tx = { financialCategory: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) } };
    const service = new FinancialCategoriesService(
      {
        financialCategory: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ id: 'category-id', createdById: 'member-id', version: 2 }),
        },
        $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
      } as never,
      {
        requireMembership: jest
          .fn()
          .mockResolvedValue({ familyId: 'family-id', role: FamilyMemberRole.CHILD }),
      } as never,
      {} as never,
    );

    await expect(service.restore('member-id', 'category-id', 1)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
