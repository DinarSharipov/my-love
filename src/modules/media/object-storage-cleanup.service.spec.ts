import { ObjectStorageCleanupAction, MediaUploadStatus } from '@prisma/client';
import { ObjectStorageCleanupService } from './object-storage-cleanup.service';

describe('ObjectStorageCleanupService', () => {
  const config = { get: jest.fn().mockReturnValue(7 * 24 * 60 * 60 * 1000) };

  it('queues a delete when S3 is temporarily unavailable', async () => {
    const storage = { deleteFile: jest.fn().mockRejectedValue(new Error('S3 unavailable')) };
    const objectStorageCleanupTask = { upsert: jest.fn().mockResolvedValue(undefined) };
    const prisma = { objectStorageCleanupTask };
    const service = new ObjectStorageCleanupService(
      prisma as never,
      storage as never,
      config as never,
    );

    await service.deleteOrEnqueue('avatars/user-id/original.jpg');

    const [[upsertArgs]] = objectStorageCleanupTask.upsert.mock.calls as unknown as [
      [
        {
          where: { dedupeKey: string };
          create: { action: ObjectStorageCleanupAction };
        },
      ],
    ];
    expect(upsertArgs.where).toEqual({ dedupeKey: 'DELETE_OBJECT:avatars/user-id/original.jpg:' });
    expect(upsertArgs.create.action).toBe(ObjectStorageCleanupAction.DELETE_OBJECT);
  });

  it('aborts expired multipart sessions and queues the S3 cleanup', async () => {
    const session = {
      id: 'session-id',
      objectKey: 'videos/family-id/session-id.mp4',
      uploadId: 'upload-id',
    };
    const storage = { abortMultipartUpload: jest.fn().mockResolvedValue(undefined) };
    const mediaUploadSession = {
      findMany: jest.fn().mockResolvedValue([session]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
    };
    const prisma = { mediaUploadSession };
    const service = new ObjectStorageCleanupService(
      prisma as never,
      storage as never,
      config as never,
    );

    await expect(
      service.cleanupExpiredMultipartUploads(new Date('2026-08-25T00:00:00Z')),
    ).resolves.toEqual({
      aborted: 1,
      purged: 2,
    });
    expect(mediaUploadSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: MediaUploadStatus.ABORTED } }),
    );
    expect(storage.abortMultipartUpload).toHaveBeenCalledWith(session.objectKey, session.uploadId);
  });

  it('retries a failed queued task with exponential backoff', async () => {
    const now = new Date('2026-08-25T00:00:00Z');
    const storage = { deleteFile: jest.fn().mockRejectedValue(new Error('S3 unavailable')) };
    const task = {
      id: 'task-id',
      action: ObjectStorageCleanupAction.DELETE_OBJECT,
      objectKey: 'previews/family-id/image.webp',
      uploadId: null,
      attempts: 2,
      nextAttemptAt: now,
      lockedUntil: null,
    };
    const objectStorageCleanupTask = {
      findMany: jest.fn().mockResolvedValue([task]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const prisma = { objectStorageCleanupTask };
    const service = new ObjectStorageCleanupService(
      prisma as never,
      storage as never,
      config as never,
    );

    await expect(service.processDue(now)).resolves.toEqual({ completed: 0, retried: 1 });
    const [[updateArgs]] = objectStorageCleanupTask.update.mock.calls as unknown as [
      [{ data: { attempts: number; lockedUntil: Date | null } }],
    ];
    expect(updateArgs.data.attempts).toBe(3);
    expect(updateArgs.data.lockedUntil).toBeNull();
  });
});
