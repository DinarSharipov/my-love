import { LedgerHistoryService } from './ledger-history.service';

describe('LedgerHistoryService', () => {
  it('filters history so entries in inaccessible wallets cannot leak', async () => {
    const count = jest.fn().mockResolvedValue(0);
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new LedgerHistoryService(
      {
        wallet: { findMany: jest.fn().mockResolvedValue([{ id: 'visible-wallet' }]) },
        ledgerTransaction: { count, findMany },
        $transaction: jest.fn((operations: unknown[]) => Promise.all(operations)),
      } as never,
      {
        requireMembership: jest.fn().mockResolvedValue({ familyId: 'family-id', role: 'PARTNER' }),
      } as never,
      {
        visibleTo: jest.fn().mockReturnValue({ OR: [{ ownerId: 'user-id' }] }),
      } as never,
    );

    await service.list('user-id', { page: 1, limit: 20 });

    expect(count).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledTimes(1);
  });
});
