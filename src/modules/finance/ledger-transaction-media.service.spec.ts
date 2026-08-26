import { NotFoundException } from '@nestjs/common';
import { LedgerTransactionMediaService } from './ledger-transaction-media.service';

describe('LedgerTransactionMediaService', () => {
  const membership = { requireMembership: jest.fn().mockResolvedValue({ familyId: 'family-1' }) };
  const history = { get: jest.fn().mockResolvedValue({ id: 'transaction-1' }) };
  const media = { findManyByIds: jest.fn().mockResolvedValue([{ id: 'media-1' }]) };

  beforeEach(() => jest.clearAllMocks());

  it('lists only media on a transaction visible through finance policy', async () => {
    const prisma = {
      ledgerTransaction: {
        findUnique: jest.fn().mockResolvedValue({
          mediaAttachments: [{ mediaId: 'media-1' }],
        }),
      },
    };
    const service = new LedgerTransactionMediaService(
      prisma as never,
      membership as never,
      history as never,
      media as never,
    );

    await expect(service.list('transaction-1', 'user-1')).resolves.toEqual([{ id: 'media-1' }]);
    expect(history.get).toHaveBeenCalledWith('user-1', 'transaction-1');
    expect(media.findManyByIds).toHaveBeenCalledWith('user-1', ['media-1']);
  });

  it('rejects media from another family before creating the relation', async () => {
    const prisma = {
      media: { findFirst: jest.fn().mockResolvedValue(null) },
      ledgerTransactionMedia: { createMany: jest.fn() },
    };
    const service = new LedgerTransactionMediaService(
      prisma as never,
      membership as never,
      history as never,
      media as never,
    );

    await expect(service.attach('transaction-1', 'user-1', 'foreign-media')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.ledgerTransactionMedia.createMany).not.toHaveBeenCalled();
  });
});
