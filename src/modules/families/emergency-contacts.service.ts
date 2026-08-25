import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { VersionConflictException } from '../../common/http/version-conflict.exception';
import { PrismaService } from '../../database/prisma.service';
import { FamilyMembershipService } from '../family-members/family-membership.service';
import { CreateEmergencyContactDto, UpdateEmergencyContactDto } from './dto/emergency-contact.dto';

@Injectable()
export class EmergencyContactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: FamilyMembershipService,
    private readonly audit: AuditService,
  ) {}
  async list(userId: string, archived = false) {
    const { familyId } = await this.membership.requirePartner(userId);
    return this.prisma.emergencyContact.findMany({
      where: { familyId, archived },
      orderBy: { updatedAt: 'desc' },
    });
  }
  async create(userId: string, dto: CreateEmergencyContactDto) {
    const { familyId } = await this.membership.requirePartner(userId);
    return this.prisma.$transaction(async (tx) => {
      const contact = await tx.emergencyContact.create({
        data: {
          familyId,
          name: dto.name.trim(),
          relationship: dto.relationship.trim(),
          phone: dto.phone.trim(),
          email: dto.email?.trim().toLowerCase() ?? null,
        },
      });
      await this.record(userId, familyId, 'created', contact.id, tx);
      return contact;
    });
  }
  async update(userId: string, id: string, dto: UpdateEmergencyContactDto, version?: number) {
    return this.mutate(
      userId,
      id,
      false,
      version,
      {
        ...(dto.name === undefined ? {} : { name: dto.name.trim() }),
        ...(dto.relationship === undefined ? {} : { relationship: dto.relationship.trim() }),
        ...(dto.phone === undefined ? {} : { phone: dto.phone.trim() }),
        ...(dto.email === undefined ? {} : { email: dto.email.trim().toLowerCase() }),
      },
      'updated',
    );
  }
  async archive(userId: string, id: string, version?: number): Promise<void> {
    await this.mutate(
      userId,
      id,
      false,
      version,
      { archived: true, archivedAt: new Date() },
      'archived',
    );
  }
  async restore(userId: string, id: string, version?: number) {
    return this.mutate(
      userId,
      id,
      true,
      version,
      { archived: false, archivedAt: null },
      'restored',
    );
  }
  private async mutate(
    userId: string,
    id: string,
    archived: boolean,
    version: number | undefined,
    data: Record<string, unknown>,
    action: string,
  ) {
    const { familyId } = await this.membership.requirePartner(userId);
    if (!(await this.prisma.emergencyContact.findFirst({ where: { id, familyId, archived } })))
      throw new NotFoundException('Emergency contact not found');
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.emergencyContact.updateMany({
        where: { id, familyId, archived, ...(version === undefined ? {} : { version }) },
        data: { ...data, version: { increment: 1 } },
      });
      if (result.count !== 1) throw new VersionConflictException(version!);
      const contact = await tx.emergencyContact.findUniqueOrThrow({ where: { id } });
      await this.record(userId, familyId, action, id, tx);
      return contact;
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
        action: `emergency_contact.${action}`,
        resourceType: 'emergency_contact',
        resourceId: id,
      },
      tx,
    );
  }
}
