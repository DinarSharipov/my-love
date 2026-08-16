import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FamilyMemberRole, WalletType, WalletVisibility } from '@prisma/client';
import { WalletsService } from './wallets.service';

describe('WalletsService', () => {
  const context = {
    familyId: 'family-id',
    role: FamilyMemberRole.PARTNER,
    defaultCurrency: 'RUB',
  };

  it('assigns personal wallet ownership from the authenticated user', async () => {
    const create = jest.fn(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'wallet-id', ...data }),
    );
    const tx = {
      wallet: { create },
      auditEvent: { create: jest.fn().mockResolvedValue({ id: 'audit-id' }) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = new WalletsService(
      prisma as never,
      { requireMembership: jest.fn().mockResolvedValue(context) } as never,
      { record: jest.fn().mockResolvedValue(undefined) } as never,
    );

    await service.create('current-user', { type: WalletType.PERSONAL, name: 'Личный' });

    expect(create).toHaveBeenCalledWith({
      data: {
        familyId: 'family-id',
        ownerId: 'current-user',
        createdById: 'current-user',
        type: WalletType.PERSONAL,
        name: 'Личный',
        visibility: WalletVisibility.PRIVATE,
        currency: 'RUB',
      },
    });
  });

  it('filters list reads to family, own wallets and partner-visible personal wallets', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new WalletsService(
      { wallet: { findMany } } as never,
      { requireMembership: jest.fn().mockResolvedValue(context) } as never,
      {} as never,
    );

    await service.list('current-user');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          familyId: 'family-id',
          archivedAt: null,
          OR: [
            { type: WalletType.FAMILY },
            { ownerId: 'current-user' },
            { type: WalletType.PERSONAL, visibility: WalletVisibility.PARTNER },
          ],
        },
      }),
    );
  });

  it('does not expose partner-visible wallets to a child member', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new WalletsService(
      { wallet: { findMany } } as never,
      {
        requireMembership: jest.fn().mockResolvedValue({
          ...context,
          role: FamilyMemberRole.CHILD,
        }),
      } as never,
      {} as never,
    );

    await service.list('child-user');

    expect(findMany).toHaveBeenCalledWith({
      where: {
        familyId: 'family-id',
        archivedAt: null,
        OR: [{ type: WalletType.FAMILY }, { ownerId: 'child-user' }],
      },
      orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
    });
  });

  it('does not allow a partner to manage another user personal wallet', async () => {
    const service = new WalletsService(
      {
        wallet: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ type: WalletType.PERSONAL, ownerId: 'partner-id' }),
        },
      } as never,
      { requireMembership: jest.fn().mockResolvedValue(context) } as never,
      {} as never,
    );

    await expect(
      service.update('current-user', 'wallet-id', { name: 'Новое имя' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects family visibility for a personal wallet', async () => {
    const service = new WalletsService(
      {} as never,
      { requireMembership: jest.fn().mockResolvedValue(context) } as never,
      {} as never,
    );

    await expect(
      service.create('current-user', {
        type: WalletType.PERSONAL,
        name: 'Личный',
        visibility: WalletVisibility.FAMILY,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
