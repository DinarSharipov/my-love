import { OutboxEventStatus } from '@prisma/client';
import { OutboxService } from './outbox.service';

describe('OutboxService metrics', () => {
  const prisma = {
    outboxEvent: { groupBy: jest.fn(), count: jest.fn(), findFirst: jest.fn() },
  };
  const config = { get: jest.fn((key: string, fallback?: unknown) => fallback) };
  const service = new OutboxService(
    prisma as never,
    config as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('returns only aggregate queue state and exposes stale processing separately', async () => {
    prisma.outboxEvent.groupBy.mockResolvedValue([
      { status: OutboxEventStatus.PENDING, _count: { _all: 3 } },
      { status: OutboxEventStatus.DELIVERED, _count: { _all: 8 } },
      { status: OutboxEventStatus.FAILED, _count: { _all: 1 } },
    ]);
    prisma.outboxEvent.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
    prisma.outboxEvent.findFirst.mockResolvedValue({
      createdAt: new Date('2026-08-31T08:00:00.000Z'),
    });

    await expect(service.getMetrics()).resolves.toMatchObject({
      pending: 3,
      retrying: 2,
      processing: 0,
      staleProcessing: 1,
      delivered: 8,
      failed: 1,
      oldestPendingAt: '2026-08-31T08:00:00.000Z',
    });
  });
});
