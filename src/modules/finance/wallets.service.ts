import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FamilyMemberRole, Prisma, WalletType, WalletVisibility } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../database/prisma.service';
import { FamilyMembershipService } from '../family-members/family-membership.service';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { UpdateWalletDto } from './dto/update-wallet.dto';

@Injectable()
export class WalletsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: FamilyMembershipService,
    private readonly audit: AuditService,
  ) {}

  async create(userId: string, dto: CreateWalletDto) {
    const context = await this.membership.requireMembership(userId);
    const visibility = this.resolveCreateVisibility(dto.type, dto.visibility);
    if (dto.type === WalletType.FAMILY && context.role !== FamilyMemberRole.PARTNER) {
      throw new ForbiddenException('A partner membership is required');
    }

    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.create({
        data: {
          familyId: context.familyId,
          ownerId: dto.type === WalletType.PERSONAL ? userId : null,
          createdById: userId,
          type: dto.type,
          visibility,
          name: dto.name,
          currency: dto.currency ?? context.defaultCurrency,
        },
      });
      await this.audit.record(
        {
          actorId: userId,
          familyId: context.familyId,
          action: 'wallet.created',
          resourceType: 'wallet',
          resourceId: wallet.id,
          metadata: { type: wallet.type, visibility: wallet.visibility },
        },
        tx,
      );
      return wallet;
    });
  }

  async list(userId: string) {
    const { familyId, role } = await this.membership.requireMembership(userId);
    return this.prisma.wallet.findMany({
      where: { familyId, archivedAt: null, ...this.visibleTo(userId, role) },
      orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async get(userId: string, walletId: string) {
    const { familyId, role } = await this.membership.requireMembership(userId);
    const wallet = await this.prisma.wallet.findFirst({
      where: { id: walletId, familyId, archivedAt: null, ...this.visibleTo(userId, role) },
    });
    if (!wallet) throw new NotFoundException('Wallet not found');
    return wallet;
  }

  async update(userId: string, walletId: string, dto: UpdateWalletDto, expectedVersion?: number) {
    const context = await this.membership.requireMembership(userId);
    const wallet = await this.requireManageable(userId, walletId, context.familyId, context.role);
    const visibility = dto.visibility ?? wallet.visibility;
    this.assertVisibility(wallet.type, visibility);

    return this.prisma.$transaction(async (tx) => {
      const result = await tx.wallet.updateMany({
        where: {
          id: wallet.id,
          familyId: context.familyId,
          archivedAt: null,
          version: expectedVersion ?? wallet.version,
        },
        data: {
          ...(dto.name === undefined ? {} : { name: dto.name }),
          visibility,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) throw new ConflictException('Wallet was changed concurrently');
      const updated = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
      await this.audit.record(
        {
          actorId: userId,
          familyId: context.familyId,
          action: 'wallet.updated',
          resourceType: 'wallet',
          resourceId: wallet.id,
          metadata: { visibility: updated.visibility },
        },
        tx,
      );
      return updated;
    });
  }

  async archive(userId: string, walletId: string, expectedVersion?: number): Promise<void> {
    const context = await this.membership.requireMembership(userId);
    const wallet = await this.requireManageable(userId, walletId, context.familyId, context.role);
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.wallet.updateMany({
        where: {
          id: wallet.id,
          familyId: context.familyId,
          archivedAt: null,
          version: expectedVersion ?? wallet.version,
        },
        data: { archivedAt: new Date(), version: { increment: 1 } },
      });
      if (result.count !== 1) throw new ConflictException('Wallet was changed concurrently');
      await this.audit.record(
        {
          actorId: userId,
          familyId: context.familyId,
          action: 'wallet.archived',
          resourceType: 'wallet',
          resourceId: wallet.id,
        },
        tx,
      );
    });
  }

  private resolveCreateVisibility(type: WalletType, visibility?: WalletVisibility) {
    const resolved =
      visibility ??
      (type === WalletType.FAMILY ? WalletVisibility.FAMILY : WalletVisibility.PRIVATE);
    this.assertVisibility(type, resolved);
    return resolved;
  }

  private assertVisibility(type: WalletType, visibility: WalletVisibility): void {
    const valid =
      type === WalletType.FAMILY
        ? visibility === WalletVisibility.FAMILY
        : visibility === WalletVisibility.PRIVATE || visibility === WalletVisibility.PARTNER;
    if (!valid) throw new BadRequestException('Visibility is incompatible with wallet type');
  }

  visibleTo(userId: string, role: FamilyMemberRole): Prisma.WalletWhereInput {
    return {
      OR: [
        { type: WalletType.FAMILY },
        { ownerId: userId },
        ...(role === FamilyMemberRole.PARTNER
          ? [{ type: WalletType.PERSONAL, visibility: WalletVisibility.PARTNER }]
          : []),
      ],
    };
  }

  private async requireManageable(
    userId: string,
    walletId: string,
    familyId: string,
    role: FamilyMemberRole,
  ) {
    const wallet = await this.prisma.wallet.findFirst({
      where: { id: walletId, familyId, archivedAt: null },
    });
    const canManage =
      wallet &&
      (wallet.ownerId === userId ||
        (wallet.type === WalletType.FAMILY && role === FamilyMemberRole.PARTNER));
    if (!canManage) throw new NotFoundException('Wallet not found');
    return wallet;
  }
}
