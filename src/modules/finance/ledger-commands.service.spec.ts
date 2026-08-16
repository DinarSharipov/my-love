import { BadRequestException, ConflictException } from '@nestjs/common';
import { LedgerCommandsService } from './ledger-commands.service';

const userId = '00000000-0000-4000-8000-000000000001';
const familyId = '00000000-0000-4000-8000-000000000002';
const walletId = '00000000-0000-4000-8000-000000000003';

describe('LedgerCommandsService', () => {
  function setup() {
    const transaction = {
      id: 'transaction-id',
      familyId,
      createdById: userId,
      type: 'INCOME',
      currency: 'RUB',
      occurredAt: new Date('2026-08-16T10:00:00.000Z'),
      note: null,
      reversesId: null,
      createdAt: new Date('2026-08-16T10:00:00.000Z'),
      entries: [
        { id: 'entry-1', walletId, amountMinor: 1250n, createdAt: new Date() },
        { id: 'entry-2', walletId: null, amountMinor: -1250n, createdAt: new Date() },
      ],
    };
    const tx = {
      wallet: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: walletId, ownerId: userId, type: 'PERSONAL', currency: 'RUB' }),
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: walletId, ownerId: userId, type: 'PERSONAL', currency: 'RUB' },
          ]),
      },
      ledgerTransaction: {
        create: jest.fn().mockResolvedValue(transaction),
        findFirst: jest.fn().mockResolvedValue({ ...transaction, reversedBy: null }),
      },
      financialCommandResult: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      financialCommandResult: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((callback: (value: typeof tx) => unknown) => callback(tx)),
    };
    const membership = {
      requireMembership: jest.fn().mockResolvedValue({ familyId, role: 'PARTNER' }),
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    return {
      service: new LedgerCommandsService(prisma as never, membership as never, audit as never),
      tx,
      prisma,
      audit,
    };
  }

  it('creates balanced income entries and serializes minor units as strings', async () => {
    const { service, tx, audit } = setup();

    await service.income(userId, 'income-key-001', { walletId, amountMinor: '1250' });

    expect(tx.ledgerTransaction.create).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ledger.income' }),
      tx,
    );
  });

  it('replays an identical command and rejects a reused key with another payload', async () => {
    const { service, prisma } = setup();
    const command = {
      requestHash: 'other-hash',
      transaction: {
        id: 'old-transaction',
        familyId,
        createdById: userId,
        type: 'EXPENSE',
        currency: 'RUB',
        occurredAt: new Date(),
        note: null,
        reversesId: null,
        createdAt: new Date(),
        entries: [{ id: 'entry', walletId, amountMinor: -1n, createdAt: new Date() }],
      },
    };
    prisma.financialCommandResult.findUnique.mockResolvedValue(command);

    await expect(
      service.expense(userId, 'reused-key-001', { walletId, amountMinor: '2' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects transfer between wallets with different identifiers missing', async () => {
    const { service } = setup();

    await expect(
      service.transfer(userId, 'transfer-key-001', {
        fromWalletId: walletId,
        toWalletId: walletId,
        amountMinor: '1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates an inverse immutable transaction for a reversal', async () => {
    const { service, tx, audit } = setup();

    await service.reverse(userId, 'transaction-id', 'reversal-key-001', {});

    expect(tx.ledgerTransaction.create).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ledger.reversal' }),
      tx,
    );
  });
});
