import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import sharp from 'sharp';
import { FamilyMembershipService } from '../family-members/family-membership.service';
import { paginationMeta } from '../../common/dto/pagination-response.dto';
import { PrismaService } from '../../database/prisma.service';
import {
  MAX_IMAGE_SIZE_BYTES,
  MAX_VIDEO_SIZE_BYTES,
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
    const isImage = file.mimetype.startsWith('image/');
    const maxSize = isImage ? MAX_IMAGE_SIZE_BYTES : MAX_VIDEO_SIZE_BYTES;
    if (file.size > maxSize) {
      await this.removeTempFile(file.path);
      throw new BadRequestException(
        `File exceeds the ${isImage ? '10 MB image' : '500 MB video'} size limit`,
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
    const objectKey = `uploads/${familyId}/${mediaId}${extension}`;
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

  private async toResponse(media: {
    id: string;
    userId: string;
    familyId: string;
    objectKey: string;
    previewObjectKey: string | null;
    originalName: string;
    mimeType: string;
    sizeBytes: bigint;
    createdAt: Date;
  }): Promise<MediaResponseDto> {
    return {
      id: media.id,
      userId: media.userId,
      originalName: media.originalName,
      mimeType: media.mimeType,
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
