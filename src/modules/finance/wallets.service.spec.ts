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

  it('lists and restores archived wallets within the authenticated family', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const findFirst = jest.fn().mockResolvedValue({
      id: 'wallet-id',
      familyId: 'family-id',
      ownerId: 'current-user',
      type: WalletType.PERSONAL,
      version: 2,
    });
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const findUniqueOrThrow = jest
      .fn()
      .mockResolvedValue({ id: 'wallet-id', archivedAt: null, version: 3 });
    const tx = { wallet: { updateMany, findUniqueOrThrow } };
    const service = new WalletsService(
      {
        wallet: { findMany, findFirst },
        $transaction: (cb: (client: typeof tx) => unknown) => cb(tx),
      } as never,
      { requireMembership: jest.fn().mockResolvedValue(context) } as never,
      { record: jest.fn().mockResolvedValue(undefined) } as never,
    );

    await service.archived('current-user');
    await expect(service.restore('current-user', 'wallet-id', 2)).resolves.toEqual(
      expect.objectContaining({ archivedAt: null }),
    );
    /* eslint-disable @typescript-eslint/no-unsafe-assignment */
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ archivedAt: { not: null } }) }),
    );
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ version: 2 }) }),
    );
    /* eslint-enable @typescript-eslint/no-unsafe-assignment */
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
