import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MediaKind } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import { FamilyMembershipService } from '../family-members/family-membership.service';
import { S3StorageService } from '../media/s3-storage.service';
import { CreateChildProfileDto, UpdateChildProfileDto } from './dto/child-profile.dto';

@Injectable()
export class ChildProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: FamilyMembershipService,
    private readonly storage: S3StorageService,
  ) {}

  async create(userId: string, dto: CreateChildProfileDto) {
    const { familyId } = await this.membership.requirePartner(userId);
    const avatarMediaId = await this.resolveAvatarMediaId(familyId, dto.avatarMediaId);
    const child = await this.prisma.childProfile.create({
      data: {
        familyId,
        firstName: dto.firstName,
        lastName: dto.lastName ?? null,
        birthDate: new Date(dto.birthDate),
        avatarUrl: dto.avatarUrl ?? null,
        avatarMediaId,
        avatarPreviewToken: avatarMediaId ? randomUUID() : null,
      },
    });
    return this.toResponse(child);
  }
  async list(userId: string) {
    const { familyId } = await this.membership.requireMembership(userId);
    const children = await this.prisma.childProfile.findMany({
      where: { familyId },
      orderBy: [{ firstName: 'asc' }, { createdAt: 'asc' }],
    });
    return children.map((child) => this.toResponse(child));
  }
  async export(userId: string, id: string) {
    const { familyId } = await this.membership.requireMembership(userId);
    const child = await this.prisma.childProfile.findFirst({
      where: { id, familyId },
      select: {
        id: true,
        familyId: true,
        firstName: true,
        lastName: true,
        birthDate: true,
        avatarUrl: true,
        avatarMediaId: true,
        avatarPreviewToken: true,
        createdAt: true,
        updatedAt: true,
        tasks: {
          orderBy: [{ createdAt: 'asc' }],
          select: {
            id: true,
            title: true,
            description: true,
            dueAt: true,
            priority: true,
            status: true,
            version: true,
            completedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        events: {
          where: { deletedAt: null },
          orderBy: [{ scheduledAt: 'asc' }],
          select: {
            id: true,
            name: true,
            description: true,
            scheduledAt: true,
            location: true,
            status: true,
            respondedAt: true,
            version: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
    if (!child) throw new NotFoundException('The child profile does not exist');
    const { tasks, events, ...profile } = child;
    return { profile: this.toResponse(profile), tasks, events };
  }
  async update(userId: string, id: string, dto: UpdateChildProfileDto) {
    const { familyId } = await this.membership.requirePartner(userId);
    const existing = await this.prisma.childProfile.findFirst({ where: { id, familyId } });
    if (!existing) throw new NotFoundException('The child profile does not exist');
    const avatarMediaId =
      dto.avatarMediaId === undefined
        ? undefined
        : await this.resolveAvatarMediaId(familyId, dto.avatarMediaId);
    const child = await this.prisma.childProfile.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        avatarUrl: dto.avatarUrl,
        avatarMediaId,
        ...(avatarMediaId === undefined
          ? {}
          : { avatarPreviewToken: avatarMediaId ? randomUUID() : null }),
      },
    });
    return this.toResponse(child);
  }
  async remove(userId: string, id: string): Promise<void> {
    const { familyId } = await this.membership.requirePartner(userId);
    const result = await this.prisma.childProfile.deleteMany({ where: { id, familyId } });
    if (!result.count) throw new NotFoundException('The child profile does not exist');
  }

  async streamAvatar(id: string, token: string | undefined, range?: string) {
    const child = await this.prisma.childProfile.findFirst({
      where: { id, avatarPreviewToken: token ?? undefined },
      select: { avatarMedia: { select: { previewObjectKey: true } } },
    });
    if (!token || !child?.avatarMedia?.previewObjectKey) {
      throw new NotFoundException('Avatar not found');
    }
    return this.storage.getObjectStream(child.avatarMedia.previewObjectKey, range);
  }

  private async resolveAvatarMediaId(familyId: string, mediaId: string | null | undefined) {
    if (mediaId === undefined || mediaId === null) return mediaId;
    const media = await this.prisma.media.findFirst({
      where: { id: mediaId, familyId, kind: MediaKind.IMAGE, previewObjectKey: { not: null } },
      select: { id: true },
    });
    if (!media) {
      throw new BadRequestException('Avatar media must be an image shared with the current family');
    }
    return media.id;
  }

  private toResponse<
    T extends {
      id: string;
      avatarUrl: string | null;
      avatarMediaId: string | null;
      avatarPreviewToken: string | null;
    },
  >(child: T): Omit<T, 'avatarPreviewToken' | 'avatarUrl'> & { avatarUrl: string | null } {
    const { avatarPreviewToken, avatarUrl, ...profile } = child;
    return {
      ...profile,
      avatarUrl:
        child.avatarMediaId && avatarPreviewToken
          ? `/api/v1/families/me/children/${child.id}/avatar?token=${encodeURIComponent(avatarPreviewToken)}`
          : avatarUrl,
    };
  }
}
