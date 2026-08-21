import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { paginationMeta } from '../../common/dto/pagination-response.dto';
import { PrismaService } from '../../database/prisma.service';
import { MAX_IMAGE_SIZE_BYTES, MAX_VIDEO_SIZE_BYTES } from './media.constants';
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
    const objectKey = `uploads/${userId}/${randomUUID()}${extension}`;
    try {
      await this.storage.uploadFile(objectKey, file.path, file.mimetype, file.size);
      const media = await this.prisma.media.create({
        data: {
          userId,
          objectKey,
          originalName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
        },
      });
      return this.toResponse(media);
    } catch (error) {
      await this.storage.deleteFile(objectKey).catch(() => undefined);
      throw error;
    } finally {
      await this.removeTempFile(file.path);
    }
  }

  async findOne(userId: string, id: string): Promise<MediaResponseDto> {
    const media = await this.prisma.media.findFirst({ where: { id, userId } });
    if (!media) throw new NotFoundException('Media not found');
    return this.toResponse(media);
  }

  async findMany(userId: string, query: MediaQueryDto): Promise<PaginatedMediaResponseDto> {
    const name = query.name?.trim();
    const where: Prisma.MediaWhereInput = {
      userId,
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
    const media = await this.prisma.media.findFirst({ where: { id, userId } });
    if (!media) throw new NotFoundException('Media not found');
    await this.storage.deleteFile(media.objectKey);
    await this.prisma.media.delete({ where: { id: media.id } });
  }

  private async toResponse(media: {
    id: string;
    userId: string;
    objectKey: string;
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
    };
  }

  private async removeTempFile(path: string): Promise<void> {
    await unlink(path).catch(() => undefined);
  }
}
