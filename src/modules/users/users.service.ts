import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { unlink } from 'node:fs/promises';
import sharp from 'sharp';
import { paginationMeta } from '../../common/dto/pagination-response.dto';
import { PrismaService } from '../../database/prisma.service';
import { S3StorageService } from '../media/s3-storage.service';
import { PaginatedUsersResponseDto } from './dto/paginated-users-response.dto';
import { PublicUserResponseDto } from './dto/public-user-response.dto';
import { UpdateCurrentUserDto } from './dto/update-current-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UsersQueryDto } from './dto/users-query.dto';
import { VersionConflictException } from '../../common/http/version-conflict.exception';
import { AccountExportResponseDto } from './dto/account-export-response.dto';

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;
const AVATAR_PREVIEW_SIZE = 320;
const AVATAR_PREVIEW_QUALITY = 82;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: S3StorageService,
  ) {}

  create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async uploadAvatar(userId: string, file: Express.Multer.File): Promise<UserResponseDto> {
    if (!file) throw new BadRequestException('File is required');
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Avatar must be an image');
    }
    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      throw new BadRequestException('Avatar exceeds the 5 MB size limit');
    }
    const previous = await this.prisma.user.findFirst({
      where: { id: userId, isActive: true },
      select: { avatarObjectKey: true, avatarPreviewObjectKey: true },
    });
    if (!previous) throw new NotFoundException('User not found');

    const extension =
      extname(file.originalname)
        .toLowerCase()
        .replace(/[^a-z0-9.]/g, '') || '.bin';
    const objectKey = `avatars/${userId}/${randomUUID()}${extension}`;
    const previewObjectKey = `avatar-previews/${userId}/${randomUUID()}.webp`;
    const previewToken = randomUUID();
    try {
      const preview = await sharp(file.path)
        .rotate()
        .resize(AVATAR_PREVIEW_SIZE, AVATAR_PREVIEW_SIZE, {
          fit: 'cover',
          position: 'centre',
          withoutEnlargement: true,
        })
        .webp({ quality: AVATAR_PREVIEW_QUALITY })
        .toBuffer();
      await this.storage.uploadFile(objectKey, file.path, file.mimetype, file.size);
      await this.storage.uploadBuffer(previewObjectKey, preview, 'image/webp');
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data: {
          avatarObjectKey: objectKey,
          avatarPreviewObjectKey: previewObjectKey,
          avatarPreviewToken: previewToken,
          avatarMimeType: file.mimetype,
          avatarSizeBytes: file.size,
          version: { increment: 1 },
        },
      });
      await this.deleteAvatarObjects(previous.avatarObjectKey, previous.avatarPreviewObjectKey);
      return UserResponseDto.fromEntity(updated);
    } catch (error) {
      await this.deleteAvatarObjects(objectKey, previewObjectKey);
      throw error;
    } finally {
      await unlink(file.path).catch(() => undefined);
    }
  }

  async removeAvatar(userId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, isActive: true },
      select: { avatarObjectKey: true, avatarPreviewObjectKey: true },
    });
    if (!user) throw new NotFoundException('User not found');
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        avatarObjectKey: null,
        avatarPreviewObjectKey: null,
        avatarPreviewToken: null,
        avatarMimeType: null,
        avatarSizeBytes: null,
        version: { increment: 1 },
      },
    });
    await this.deleteAvatarObjects(user.avatarObjectKey, user.avatarPreviewObjectKey);
  }

  async streamAvatar(id: string, token: string | undefined, range?: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, isActive: true },
      select: { avatarPreviewObjectKey: true, avatarPreviewToken: true },
    });
    if (!user?.avatarPreviewObjectKey || !token || token !== user.avatarPreviewToken) {
      throw new NotFoundException('Avatar not found');
    }
    return this.storage.getObjectStream(user.avatarPreviewObjectKey, range);
  }

  async findCurrent(id: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findFirst({ where: { id, isActive: true } });
    if (!user) throw new NotFoundException('User not found');
    return UserResponseDto.fromEntity(user);
  }

  async exportCurrent(id: string): Promise<AccountExportResponseDto> {
    const user = await this.prisma.user.findFirst({
      where: { id, isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        gender: true,
        description: true,
        birthDate: true,
        phone: true,
        avatarPreviewObjectKey: true,
        avatarPreviewToken: true,
        locale: true,
        timeZone: true,
        version: true,
        createdAt: true,
        updatedAt: true,
        deletionRequestedAt: true,
        deletionScheduledAt: true,
        familyMember: {
          select: {
            family: {
              select: {
                id: true,
                status: true,
                timeZone: true,
                locale: true,
                defaultCurrency: true,
                createdAt: true,
                updatedAt: true,
                members: { select: { id: true, userId: true, role: true, joinedAt: true } },
                events: {
                  orderBy: { scheduledAt: 'asc' },
                  select: {
                    id: true,
                    familyId: true,
                    proposedById: true,
                    respondedById: true,
                    deletedById: true,
                    name: true,
                    description: true,
                    scheduledAt: true,
                    location: true,
                    status: true,
                    respondedAt: true,
                    deletedAt: true,
                    version: true,
                    createdAt: true,
                    updatedAt: true,
                  },
                },
                firstDate: {
                  select: {
                    id: true,
                    familyId: true,
                    createdById: true,
                    name: true,
                    date: true,
                    description: true,
                    version: true,
                    createdAt: true,
                    updatedAt: true,
                  },
                },
              },
            },
          },
        },
        sentFamilyInvitations: {
          select: {
            id: true,
            recipientId: true,
            status: true,
            expiresAt: true,
            respondedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        receivedFamilyInvitations: {
          select: {
            id: true,
            senderId: true,
            status: true,
            expiresAt: true,
            respondedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        sentPrivateInvitations: {
          select: {
            id: true,
            recipientEmail: true,
            status: true,
            expiresAt: true,
            respondedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    const {
      familyMember,
      sentFamilyInvitations,
      receivedFamilyInvitations,
      sentPrivateInvitations,
      avatarPreviewObjectKey,
      avatarPreviewToken,
      ...profile
    } = user;
    return {
      format: 'my-love-account-export',
      exportedAt: new Date(),
      profile: {
        ...profile,
        avatarUrl:
          avatarPreviewObjectKey && avatarPreviewToken
            ? `/api/v1/users/${id}/avatar?token=${encodeURIComponent(avatarPreviewToken)}`
            : null,
      },
      families: familyMember ? [familyMember.family] : [],
      invitations: [
        ...sentFamilyInvitations,
        ...receivedFamilyInvitations,
        ...sentPrivateInvitations,
      ],
    };
  }

  async updateCurrent(
    id: string,
    dto: UpdateCurrentUserDto,
    expectedVersion?: number,
  ): Promise<UserResponseDto> {
    const data: Prisma.UserUpdateManyMutationInput = {
      ...dto,
      description: dto.description === '' ? null : dto.description,
      phone: dto.phone === '' ? null : dto.phone,
      version: { increment: 1 },
    };
    const result = await this.prisma.user.updateMany({
      where: { id, isActive: true, ...(expectedVersion ? { version: expectedVersion } : {}) },
      data,
    });
    if (result.count !== 1) {
      const exists = await this.prisma.user.count({ where: { id, isActive: true } });
      if (!exists) throw new NotFoundException('User not found');
      throw new VersionConflictException(expectedVersion as number);
    }
    return this.findCurrent(id);
  }

  async findRegistry(
    currentUserId: string,
    query: UsersQueryDto,
  ): Promise<PaginatedUsersResponseDto> {
    const search = query.search?.trim();
    const where: Prisma.UserWhereInput = {
      id: { not: currentUserId },
      isActive: true,
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: { familyMember: { select: { id: true } } },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users.map((user) => PublicUserResponseDto.fromEntity(user)),
      ...paginationMeta(total, query.page, query.limit),
    };
  }

  async findPublicById(id: string): Promise<PublicUserResponseDto> {
    const user = await this.prisma.user.findFirst({
      where: { id, isActive: true },
      include: { familyMember: { select: { id: true } } },
    });
    if (!user) throw new NotFoundException('User not found');
    return PublicUserResponseDto.fromEntity(user);
  }

  private async deleteAvatarObjects(objectKey: string | null, previewObjectKey: string | null) {
    await Promise.all([
      objectKey ? this.storage.deleteFile(objectKey).catch(() => undefined) : Promise.resolve(),
      previewObjectKey
        ? this.storage.deleteFile(previewObjectKey).catch(() => undefined)
        : Promise.resolve(),
    ]);
  }
}
