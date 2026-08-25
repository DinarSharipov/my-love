import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { VersionConflictException } from '../../common/http/version-conflict.exception';
import { PrismaService } from '../../database/prisma.service';
import { FamilyMembershipService } from '../family-members/family-membership.service';
import { CreateChildProfileDto, UpdateChildProfileDto } from './dto/child-profile.dto';

@Injectable()
export class ChildProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: FamilyMembershipService,
    private readonly audit: AuditService,
  ) {}

  async create(userId: string, dto: CreateChildProfileDto) {
    const { familyId } = await this.membership.requirePartner(userId);
    return this.prisma.$transaction(async (tx) => {
      const child = await tx.childProfile.create({
        data: {
          familyId,
          firstName: dto.firstName,
          lastName: dto.lastName ?? null,
          birthDate: new Date(dto.birthDate),
          avatarUrl: dto.avatarUrl ?? null,
        },
      });
      await this.record(userId, familyId, 'created', child.id, tx);
      return child;
    });
  }

  async list(userId: string) {
    const { familyId } = await this.membership.requirePartner(userId);
    return this.prisma.childProfile.findMany({
      where: { familyId, archived: false },
      orderBy: [{ firstName: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async listArchived(userId: string) {
    const { familyId } = await this.membership.requirePartner(userId);
    return this.prisma.childProfile.findMany({
      where: { familyId, archived: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async export(userId: string, id: string) {
    const { familyId } = await this.membership.requirePartner(userId);
    const child = await this.prisma.childProfile.findFirst({
      where: { id, familyId },
      select: {
        id: true,
        familyId: true,
        firstName: true,
        lastName: true,
        birthDate: true,
        avatarUrl: true,
        archived: true,
        archivedAt: true,
        version: true,
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
    return { profile, tasks, events };
  }

  async update(userId: string, id: string, dto: UpdateChildProfileDto, expectedVersion?: number) {
    return this.mutate(
      userId,
      id,
      false,
      expectedVersion,
      {
        ...(dto.firstName === undefined ? {} : { firstName: dto.firstName }),
        ...(dto.lastName === undefined ? {} : { lastName: dto.lastName }),
        ...(dto.birthDate === undefined ? {} : { birthDate: new Date(dto.birthDate) }),
        ...(dto.avatarUrl === undefined ? {} : { avatarUrl: dto.avatarUrl }),
      },
      'updated',
    );
  }

  async archive(userId: string, id: string, expectedVersion?: number): Promise<void> {
    await this.mutate(
      userId,
      id,
      false,
      expectedVersion,
      { archived: true, archivedAt: new Date() },
      'archived',
    );
  }

  async restore(userId: string, id: string, expectedVersion?: number) {
    return this.mutate(
      userId,
      id,
      true,
      expectedVersion,
      { archived: false, archivedAt: null },
      'restored',
    );
  }

  private async mutate(
    userId: string,
    id: string,
    archived: boolean,
    expectedVersion: number | undefined,
    data: Record<string, unknown>,
    action: 'updated' | 'archived' | 'restored',
  ) {
    const { familyId } = await this.membership.requirePartner(userId);
    const current = await this.prisma.childProfile.findFirst({ where: { id, familyId, archived } });
    if (!current) throw new NotFoundException('The child profile does not exist');
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.childProfile.updateMany({
        where: {
          id,
          familyId,
          archived,
          ...(expectedVersion === undefined ? {} : { version: expectedVersion }),
        },
        data: { ...data, version: { increment: 1 } },
      });
      if (result.count !== 1) throw new VersionConflictException(expectedVersion!);
      const child = await tx.childProfile.findUniqueOrThrow({ where: { id } });
      await this.record(userId, familyId, action, id, tx);
      return child;
    });
  }

  private record(
    userId: string,
    familyId: string,
    action: string,
    id: string,
    tx: Parameters<AuditService['record']>[1],
  ) {
    return this.audit.record(
      {
        actorId: userId,
        familyId,
        action: `child_profile.${action}`,
        resourceType: 'child_profile',
        resourceId: id,
      },
      tx,
    );
  }
}
