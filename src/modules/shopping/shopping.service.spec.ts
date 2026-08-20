import { ConflictException, NotFoundException } from '@nestjs/common';
import { ShoppingService } from './shopping.service';

describe('ShoppingService', () => {
  it('does not accept an item through a different list URL', async () => {
    const prisma = {
      shoppingItem: {
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn(),
      },
    };
    const membership = {
      requireMembership: jest.fn().mockResolvedValue({ familyId: 'family-id' }),
    };
    const service = new ShoppingService(
      prisma as never,
      membership as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.checkItem('user-id', 'wrong-list-id', 'item-id', true, 1),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.shoppingItem.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'item-id',
        listId: 'wrong-list-id',
        list: { familyId: 'family-id', archived: false },
      },
    });
    expect(prisma.shoppingItem.updateMany).not.toHaveBeenCalled();
  });

  it('restores an archived list only inside the caller family and matching version', async () => {
    const prisma = {
      shoppingList: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ id: 'list-id', archived: false, version: 4, items: [] }),
      },
    };
    const membership = {
      requireMembership: jest.fn().mockResolvedValue({ familyId: 'family-id' }),
    };
    const audit = { record: jest.fn() };
    const service = new ShoppingService(
      prisma as never,
      membership as never,
      audit as never,
      {} as never,
    );

    await expect(service.restoreList('user-id', 'list-id', 3)).resolves.toMatchObject({
      archived: false,
    });
    expect(prisma.shoppingList.updateMany).toHaveBeenCalledWith({
      where: { id: 'list-id', familyId: 'family-id', archived: true, version: 3 },
      data: { archived: false, version: { increment: 1 } },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'shopping_list.restored' }),
    );
  });

  it('reports a concurrent change while restoring a list', async () => {
    const prisma = {
      shoppingList: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findFirst: jest.fn().mockResolvedValue({ id: 'list-id' }),
      },
    };
    const service = new ShoppingService(
      prisma as never,
      { requireMembership: jest.fn().mockResolvedValue({ familyId: 'family-id' }) } as never,
      {} as never,
      {} as never,
    );
    await expect(service.restoreList('user-id', 'list-id', 2)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
