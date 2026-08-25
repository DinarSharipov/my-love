import { Injectable, Logger } from '@nestjs/common';
import { MediaUploadStatus, ObjectStorageCleanupAction } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { S3StorageService } from './s3-storage.service';

const BATCH_SIZE = 100;
const LOCK_MS = 5 * 60 * 1000;
const MAX_BACKOFF_MS = 60 * 60 * 1000;

@Injectable()
export class ObjectStorageCleanupService {
  private readonly logger = new Logger(ObjectStorageCleanupService.name);
  private readonly multipartSessionRetentionMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: S3StorageService,
    config: ConfigService,
  ) {
    this.multipartSessionRetentionMs = config.get<number>(
      'S3_MULTIPART_UPLOAD_SESSION_RETENTION_MS',
      7 * 24 * 60 * 60 * 1000,
    );
  }

  async deleteOrEnqueue(objectKey: string): Promise<void> {
    try {
      await this.storage.deleteFile(objectKey);
    } catch (error) {
      await this.enqueue(ObjectStorageCleanupAction.DELETE_OBJECT, objectKey, undefined, error);
    }
  }

  async abortOrEnqueue(objectKey: string, uploadId: string): Promise<void> {
    try {
      await this.storage.abortMultipartUpload(objectKey, uploadId);
    } catch (error) {
      await this.enqueue(
        ObjectStorageCleanupAction.ABORT_MULTIPART_UPLOAD,
        objectKey,
        uploadId,
        error,
      );
    }
  }

  async cleanupExpiredMultipartUploads(
    now = new Date(),
  ): Promise<{ aborted: number; purged: number }> {
    const sessions = await this.prisma.mediaUploadSession.findMany({
      where: { status: MediaUploadStatus.INITIATED, expiresAt: { lte: now } },
      take: BATCH_SIZE,
      orderBy: { expiresAt: 'asc' },
    });
    let aborted = 0;
    for (const session of sessions) {
      const claimed = await this.prisma.mediaUploadSession.updateMany({
        where: { id: session.id, status: MediaUploadStatus.INITIATED, expiresAt: { lte: now } },
        data: { status: MediaUploadStatus.ABORTED },
      });
      if (claimed.count !== 1) continue;
      await this.abortOrEnqueue(session.objectKey, session.uploadId);
      aborted += 1;
    }
    const purged = await this.prisma.mediaUploadSession.deleteMany({
      where: {
        status: { not: MediaUploadStatus.INITIATED },
        createdAt: { lte: new Date(now.getTime() - this.multipartSessionRetentionMs) },
      },
    });
    return { aborted, purged: purged.count };
  }

  async processDue(now = new Date()): Promise<{ completed: number; retried: number }> {
    const tasks = await this.prisma.objectStorageCleanupTask.findMany({
      where: {
        nextAttemptAt: { lte: now },
        OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }],
      },
      orderBy: { nextAttemptAt: 'asc' },
      take: BATCH_SIZE,
    });
    let completed = 0;
    let retried = 0;
    for (const task of tasks) {
      const claimed = await this.prisma.objectStorageCleanupTask.updateMany({
        where: {
          id: task.id,
          nextAttemptAt: { lte: now },
          OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }],
        },
        data: { lockedUntil: new Date(now.getTime() + LOCK_MS) },
      });
      if (claimed.count !== 1) continue;
      try {
        if (task.action === ObjectStorageCleanupAction.DELETE_OBJECT) {
          await this.storage.deleteFile(task.objectKey);
        } else if (task.uploadId) {
          await this.storage.abortMultipartUpload(task.objectKey, task.uploadId);
        }
        await this.prisma.objectStorageCleanupTask.delete({ where: { id: task.id } });
        completed += 1;
      } catch (error) {
        const attempts = task.attempts + 1;
        await this.prisma.objectStorageCleanupTask.update({
          where: { id: task.id },
          data: {
            attempts,
            lockedUntil: null,
            nextAttemptAt: new Date(now.getTime() + this.backoffMs(attempts)),
            lastError: this.errorMessage(error),
          },
        });
        retried += 1;
      }
    }
    if (completed || retried) {
      this.logger.log({ event: 'object_storage_cleanup_completed', completed, retried });
    }
    return { completed, retried };
  }

  private async enqueue(
    action: ObjectStorageCleanupAction,
    objectKey: string,
    uploadId: string | undefined,
    error: unknown,
  ): Promise<void> {
    const dedupeKey = `${action}:${objectKey}:${uploadId ?? ''}`;
    await this.prisma.objectStorageCleanupTask.upsert({
      where: { dedupeKey },
      create: {
        dedupeKey,
        action,
        objectKey,
        uploadId,
        lastError: this.errorMessage(error),
      },
      update: {
        lockedUntil: null,
        nextAttemptAt: new Date(),
        lastError: this.errorMessage(error),
      },
    });
  }

  private backoffMs(attempts: number): number {
    return Math.min(MAX_BACKOFF_MS, 1000 * 2 ** Math.min(attempts, 10));
  }

  private errorMessage(error: unknown): string {
    return (error instanceof Error ? error.message : 'Unknown object storage error').slice(0, 1000);
  }
}
