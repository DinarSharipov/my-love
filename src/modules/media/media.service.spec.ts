import { NotFoundException } from '@nestjs/common';
import { MediaService } from './media.service';

describe('MediaService', () => {
  const storage = {
    createDownloadUrl: jest.fn().mockResolvedValue('https://signed.example/media'),
    deleteFile: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => jest.clearAllMocks());

  it('lists only the authenticated user media with name/date filters and pagination', async () => {
    const item = {
      id: 'media-id',
      userId: 'user-id',
      objectKey: 'uploads/user-id/object.jpg',
      originalName: 'photo.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: BigInt(42),
      createdAt: new Date('2026-08-21T10:00:00.000Z'),
    };
    const prisma = {
      media: {
        findMany: jest.fn().mockResolvedValue([item]),
        count: jest.fn().mockResolvedValue(1),
      },
      $transaction: jest.fn().mockResolvedValue([[item], 1]),
    };
    const service = new MediaService(prisma as never, storage as never);

    await expect(
      service.findMany('user-id', {
        page: 2,
        limit: 10,
        name: ' photo ',
        dateFrom: '2026-08-20T00:00:00.000Z',
        dateTo: '2026-08-22T00:00:00.000Z',
      }),
    ).resolves.toMatchObject({ total: 1, page: 2, limit: 10, data: [{ id: 'media-id' }] });

    expect(prisma.$transaction).toHaveBeenCalled();
    const findManyCalls = prisma.media.findMany.mock.calls as unknown as Array<
      [{ where: unknown }]
    >;
    const [findManyArgs] = findManyCalls[0];
    expect(findManyArgs.where).toEqual({
      userId: 'user-id',
      originalName: { contains: 'photo', mode: 'insensitive' },
      createdAt: {
        gte: new Date('2026-08-20T00:00:00.000Z'),
        lte: new Date('2026-08-22T00:00:00.000Z'),
      },
    });
  });

  it('does not reveal a foreign media item', async () => {
    const prisma = { media: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new MediaService(prisma as never, storage as never);

    await expect(service.findOne('user-id', 'foreign-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(storage.createDownloadUrl).not.toHaveBeenCalled();
  });

  it('deletes the object before deleting owned metadata', async () => {
    const prisma = {
      media: {
        findFirst: jest.fn().mockResolvedValue({ id: 'media-id', objectKey: 'object-key' }),
        delete: jest.fn().mockResolvedValue(undefined),
      },
    };
    const service = new MediaService(prisma as never, storage as never);

    await service.remove('user-id', 'media-id');

    expect(storage.deleteFile).toHaveBeenCalledWith('object-key');
    expect(prisma.media.delete).toHaveBeenCalledWith({ where: { id: 'media-id' } });
  });
});
