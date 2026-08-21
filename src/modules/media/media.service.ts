import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MediaKind, MediaUploadStatus, Prisma } from '@prisma/client';
import { unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import sharp from 'sharp';
import { FamilyMembershipService } from '../family-members/family-membership.service';
import { paginationMeta } from '../../common/dto/pagination-response.dto';
import { PrismaService } from '../../database/prisma.service';
import {
  MEDIA_UPLOAD_PART_SIZE_BYTES,
  MEDIA_UPLOAD_URL_EXPIRES_IN,
  getMediaKind,
  getMediaMaxSize,
  getMediaStoragePrefix,
  MEDIA_PREVIEW_QUALITY,
  MEDIA_PREVIEW_SIZE,
} from './media.constants';
import { MediaQueryDto } from './dto/media-query.dto';
import { MediaResponseDto } from './dto/media-response.dto';
import { PaginatedMediaResponseDto } from './dto/paginated-media-response.dto';
import { S3StorageService } from './s3-storage.service';

type UploadedMediaFile = Express.Multer.File;

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: S3StorageService,
    private readonly membership: FamilyMembershipService,
  ) {}

  async create(userId: string, file: UploadedMediaFile): Promise<MediaResponseDto> {
    const kind = getMediaKind(file.mimetype);
    if (!kind) {
      await this.removeTempFile(file.path);
      throw new BadRequestException('Unsupported image, video or audio format');
    }
    const isImage = kind === 'IMAGE';
    const maxSize = getMediaMaxSize(kind);
    if (file.size > maxSize) {
      await this.removeTempFile(file.path);
      throw new BadRequestException(
        `File exceeds the ${kind === 'IMAGE' ? '10 MB image' : kind === 'VIDEO' ? '500 MB video' : '100 MB audio'} size limit`,
      );
    }

    const extension = extname(file.originalname)
      .toLowerCase()
      .replace(/[^a-z0-9.]/g, '');
    let familyId: string;
    try {
      ({ familyId } = await this.membership.requireMembership(userId));
    } catch (error) {
      await this.removeTempFile(file.path);
      throw error;
    }
    const mediaId = randomUUID();
    const objectKey = `${getMediaStoragePrefix(kind)}/${familyId}/${mediaId}${extension}`;
    let previewObjectKey: string | undefined;
    try {
      await this.storage.uploadFile(objectKey, file.path, file.mimetype, file.size);
      if (isImage) {
        previewObjectKey = `previews/${familyId}/${mediaId}.webp`;
        const preview = await sharp(file.path)
          .rotate()
          .resize(MEDIA_PREVIEW_SIZE, MEDIA_PREVIEW_SIZE, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp({ quality: MEDIA_PREVIEW_QUALITY })
          .toBuffer();
        await this.storage.uploadBuffer(previewObjectKey, preview, 'image/webp');
      }
      const media = await this.prisma.media.create({
        data: {
          id: mediaId,
          userId,
          familyId,
          objectKey,
          previewObjectKey,
          originalName: file.originalname,
          mimeType: file.mimetype,
          kind,
          sizeBytes: file.size,
        },
      });
      return this.toResponse(media);
    } catch (error) {
      await this.storage.deleteFile(objectKey).catch(() => undefined);
      if (previewObjectKey) await this.storage.deleteFile(previewObjectKey).catch(() => undefined);
      throw error;
    } finally {
      await this.removeTempFile(file.path);
    }
  }

  async initiateUpload(
    userId: string,
    input: { originalName: string; mimeType: string; sizeBytes: number },
  ) {
    const kind = getMediaKind(input.mimeType);
    if (!kind) throw new BadRequestException('Unsupported image, video or audio format');
    const maxSize = getMediaMaxSize(kind);
    if (input.sizeBytes > maxSize) {
      throw new BadRequestException(
        `File exceeds the ${kind === 'IMAGE' ? '10 MB image' : kind === 'VIDEO' ? '500 MB video' : '100 MB audio'} size limit`,
      );
    }
    const { familyId } = await this.membership.requireMembership(userId);
    const sessionId = randomUUID();
    const extension = extname(input.originalName)
      .toLowerCase()
      .replace(/[^a-z0-9.]/g, '');
    const objectKey = `${getMediaStoragePrefix(kind)}/${familyId}/${sessionId}${extension}`;
    const uploadId = await this.storage.initiateMultipartUpload(objectKey, input.mimeType);
    const expiresAt = new Date(Date.now() + MEDIA_UPLOAD_URL_EXPIRES_IN * 1000);
    try {
      await this.prisma.mediaUploadSession.create({
        data: {
          id: sessionId,
          uploadId,
          userId,
          familyId,
          objectKey,
          originalName: input.originalName,
          mimeType: input.mimeType,
          kind,
          sizeBytes: input.sizeBytes,
          expiresAt,
        },
      });
      const partCount = Math.ceil(input.sizeBytes / MEDIA_UPLOAD_PART_SIZE_BYTES);
      return {
        sessionId,
        objectKey,
        partSizeBytes: MEDIA_UPLOAD_PART_SIZE_BYTES,
        parts: await Promise.all(
          Array.from({ length: partCount }, (_, index) =>
            this.storage
              .createPartUploadUrl(objectKey, uploadId, index + 1)
              .then((url) => ({ partNumber: index + 1, url })),
          ),
        ),
        expiresAt,
      };
    } catch (error) {
      await this.prisma.mediaUploadSession
        .delete({ where: { id: sessionId } })
        .catch(() => undefined);
      await this.storage.abortMultipartUpload(objectKey, uploadId).catch(() => undefined);
      throw error;
    }
  }

  async getUploadStatus(userId: string, sessionId: string) {
    const { familyId } = await this.membership.requireMembership(userId);
    const session = await this.prisma.mediaUploadSession.findFirst({
      where: { id: sessionId, userId, familyId },
    });
    if (!session) throw new NotFoundException('Upload session not found');
    if (session.status !== MediaUploadStatus.INITIATED) {
      return { status: session.status, uploadedBytes: 0, totalBytes: Number(session.sizeBytes) };
    }
    const parts = await this.storage.listUploadedParts(session.objectKey, session.uploadId);
    return {
      status: session.status,
      uploadedBytes: parts.reduce((sum, part) => sum + part.sizeBytes, 0),
      totalBytes: Number(session.sizeBytes),
    };
  }

  async completeUpload(
    userId: string,
    sessionId: string,
    parts: Array<{ partNumber: number; etag: string }>,
  ) {
    const { familyId } = await this.membership.requireMembership(userId);
    const session = await this.prisma.mediaUploadSession.findFirst({
      where: { id: sessionId, userId, familyId },
    });
    if (
      !session ||
      session.status !== MediaUploadStatus.INITIATED ||
      session.expiresAt < new Date()
    ) {
      throw new NotFoundException('Upload session not found or expired');
    }
    await this.storage.completeMultipartUpload(
      session.objectKey,
      session.uploadId,
      parts.map((part) => ({ PartNumber: part.partNumber, ETag: part.etag })),
    );
    const storedObject = await this.storage.headObject(session.objectKey);
    if (storedObject.contentLength !== Number(session.sizeBytes)) {
      await this.storage.deleteFile(session.objectKey).catch(() => undefined);
      throw new BadRequestException('Uploaded object size does not match the declared size');
    }
    let previewObjectKey: string | undefined;
    try {
      if (session.kind === MediaKind.IMAGE) {
        previewObjectKey = `previews/${familyId}/${session.id}.webp`;
        const preview = await sharp(await this.storage.downloadBuffer(session.objectKey))
          .rotate()
          .resize(320, 320, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 82 })
          .toBuffer();
        await this.storage.uploadBuffer(previewObjectKey, preview, 'image/webp');
      }
      const media = await this.prisma.$transaction(async (tx) => {
        const item = await tx.media.create({
          data: {
            id: session.id,
            userId: session.userId,
            familyId: session.familyId,
            objectKey: session.objectKey,
            previewObjectKey,
            originalName: session.originalName,
            mimeType: session.mimeType,
            kind: session.kind,
            sizeBytes: session.sizeBytes,
          },
        });
        await tx.mediaUploadSession.update({
          where: { id: session.id },
          data: { status: MediaUploadStatus.COMPLETED },
        });
        return item;
      });
      return this.toResponse(media);
    } catch (error) {
      if (previewObjectKey) await this.storage.deleteFile(previewObjectKey).catch(() => undefined);
      await this.storage.deleteFile(session.objectKey).catch(() => undefined);
      throw error;
    }
  }

  async abortUpload(userId: string, sessionId: string): Promise<void> {
    const { familyId } = await this.membership.requireMembership(userId);
    const session = await this.prisma.mediaUploadSession.findFirst({
      where: { id: sessionId, userId, familyId },
    });
    if (!session || session.status !== MediaUploadStatus.INITIATED)
      throw new NotFoundException('Upload session not found');
    await this.storage.abortMultipartUpload(session.objectKey, session.uploadId);
    await this.prisma.mediaUploadSession.update({
      where: { id: session.id },
      data: { status: MediaUploadStatus.ABORTED },
    });
  }

  async findOne(userId: string, id: string): Promise<MediaResponseDto> {
    const { familyId } = await this.membership.requireMembership(userId);
    const media = await this.prisma.media.findFirst({ where: { id, familyId } });
    if (!media) throw new NotFoundException('Media not found');
    return this.toResponse(media);
  }

  async findMany(userId: string, query: MediaQueryDto): Promise<PaginatedMediaResponseDto> {
    const { familyId } = await this.membership.requireMembership(userId);
    const name = query.name?.trim();
    const where: Prisma.MediaWhereInput = {
      familyId,
      ...(name ? { originalName: { contains: name, mode: 'insensitive' } } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            },
          }
        : {}),
    };
    const [media, total] = await this.prisma.$transaction([
      this.prisma.media.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.media.count({ where }),
    ]);
    return {
      data: await Promise.all(media.map((item) => this.toResponse(item))),
      ...paginationMeta(total, query.page, query.limit),
    };
  }

  async remove(userId: string, id: string): Promise<void> {
    const { familyId } = await this.membership.requireMembership(userId);
    const media = await this.prisma.media.findFirst({ where: { id, userId, familyId } });
    if (!media) throw new NotFoundException('Media not found');
    await this.storage.deleteFile(media.objectKey);
    if (media.previewObjectKey) await this.storage.deleteFile(media.previewObjectKey);
    await this.prisma.media.delete({ where: { id: media.id } });
  }

  async stream(
    userId: string,
    id: string,
    range?: string,
    download = false,
    expectedKind?: MediaKind,
  ) {
    const { familyId } = await this.membership.requireMembership(userId);
    const media = await this.prisma.media.findFirst({ where: { id, familyId } });
    if (!media || (expectedKind && media.kind !== expectedKind))
      throw new NotFoundException('Media not found');
    const object = await this.storage.getObjectStream(media.objectKey, range);
    return { ...object, mimeType: media.mimeType, originalName: media.originalName, download };
  }

  private async toResponse(media: {
    id: string;
    userId: string;
    familyId: string;
    objectKey: string;
    previewObjectKey: string | null;
    originalName: string;
    mimeType: string;
    kind: MediaKind;
    sizeBytes: bigint;
    createdAt: Date;
  }): Promise<MediaResponseDto> {
    return {
      id: media.id,
      userId: media.userId,
      originalName: media.originalName,
      mimeType: media.mimeType,
      kind: media.kind,
      sizeBytes: Number(media.sizeBytes),
      createdAt: media.createdAt,
      downloadUrl: await this.storage.createDownloadUrl(media.objectKey),
      previewUrl: media.previewObjectKey
        ? await this.storage.createDownloadUrl(media.previewObjectKey)
        : null,
    };
  }

  private async removeTempFile(path: string): Promise<void> {
    await unlink(path).catch(() => undefined);
  }
}
