import { NotFoundException } from '@nestjs/common';
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
});
