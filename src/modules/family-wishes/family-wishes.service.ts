import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FamilyMemberRole,
  FamilyWishApprovalStatus,
  FamilyWishImplementationStatus,
  FamilyWishRealizationConfirmationStatus,
  Prisma,
} from '@prisma/client';
import { paginationMeta } from '../../common/dto/pagination-response.dto';
import { VersionConflictException } from '../../common/http/version-conflict.exception';
import { NotificationProducerService } from '../../common/notifications/notification-producer.service';
import { PrismaService } from '../../database/prisma.service';
import { FamilyMembershipService } from '../family-members/family-membership.service';
import { CreateFamilyWishDto } from './dto/create-family-wish.dto';
import { FamilyWishesQueryDto } from './dto/family-wishes-query.dto';
import {
  FamilyWishEntity,
  FamilyWishResponseDto,
  PaginatedFamilyWishesResponseDto,
} from './dto/family-wish-response.dto';
import { UpdateFamilyWishDto } from './dto/update-family-wish.dto';

const wishInclude = {
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  partner: { select: { id: true, firstName: true, lastName: true } },
  realizedBy: { select: { id: true, firstName: true, lastName: true } },
} as const;

@Injectable()
export class FamilyWishesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: FamilyMembershipService,
    private readonly notifications: NotificationProducerService,
  ) {}

  async create(userId: string, dto: CreateFamilyWishDto): Promise<FamilyWishResponseDto> {
    const { familyId } = await this.membership.requirePartner(userId);
    if (dto.partnerId === userId)
      throw new BadRequestException('A wish partner must be another user');
    const partnerUserId = await this.resolveFamilyPartner(familyId, dto.partnerId);
    if (partnerUserId === userId)
      throw new BadRequestException('A wish partner must be another user');

    const wish = await this.prisma.$transaction(async (tx) => {
      const created = await tx.familyWish.create({
        data: {
          familyId,
          createdById: userId,
          partnerId: partnerUserId,
          title: dto.title,
          description: dto.description ?? null,
        },
        include: wishInclude,
      });
      await this.notifications.notifyUserInTransaction(tx, {
        userId: partnerUserId,
        familyId,
        type: 'FAMILY_WISH_CREATED',
        title: 'Новое семейное желание',
        body: dto.title,
      });
      return created;
    });
    return FamilyWishResponseDto.fromEntity(wish);
  }

  async findAll(
    userId: string,
    query: FamilyWishesQueryDto,
  ): Promise<PaginatedFamilyWishesResponseDto> {
    const { familyId } = await this.membership.requirePartner(userId);
    if (
      query.createdFrom &&
      query.createdTo &&
      new Date(query.createdFrom) >= new Date(query.createdTo)
    ) {
      throw new BadRequestException('createdFrom must be earlier than createdTo');
    }
    const where: Prisma.FamilyWishWhereInput = {
      familyId,
      deletedAt: null,
      ...(query.implementationStatus ? { implementationStatus: query.implementationStatus } : {}),
      ...(query.partnerApprovalStatus
        ? { partnerApprovalStatus: query.partnerApprovalStatus }
        : {}),
      ...(query.createdFrom || query.createdTo
        ? {
            createdAt: {
              ...(query.createdFrom ? { gte: new Date(query.createdFrom) } : {}),
              ...(query.createdTo ? { lt: new Date(query.createdTo) } : {}),
            },
          }
        : {}),
    };
    const [wishes, total] = await this.prisma.$transaction([
      this.prisma.familyWish.findMany({
        where,
        include: wishInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.familyWish.count({ where }),
    ]);
    return {
      data: wishes.map((wish) => FamilyWishResponseDto.fromEntity(wish)),
      ...paginationMeta(total, query.page, query.limit),
    };
  }

  async findOne(userId: string, wishId: string): Promise<FamilyWishResponseDto> {
    const wish = await this.requireWish(userId, wishId);
    return FamilyWishResponseDto.fromEntity(wish);
  }

  async update(userId: string, wishId: string, dto: UpdateFamilyWishDto, expectedVersion?: number) {
    if (dto.title === undefined && dto.description === undefined)
      throw new BadRequestException('At least one field must be provided');
    const { familyId } = await this.membership.requirePartner(userId);
    const wish = await this.prisma.$transaction(async (tx) => {
      const current = await tx.familyWish.findFirst({
        where: { id: wishId, familyId, deletedAt: null },
        include: wishInclude,
      });
      if (!current) throw new NotFoundException('Family wish not found');
      if (current.createdById !== userId)
        throw new ForbiddenException('Only the wish creator can update it');
      const result = await tx.familyWish.updateMany({
        where: {
          id: wishId,
          familyId,
          deletedAt: null,
          ...(expectedVersion === undefined ? {} : { version: expectedVersion }),
        },
        data: {
          title: dto.title,
          description: dto.description === undefined ? undefined : dto.description,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) {
        if (expectedVersion !== undefined) throw new VersionConflictException(expectedVersion);
        throw new NotFoundException('Family wish not found');
      }
      return tx.familyWish.findFirstOrThrow({ where: { id: wishId }, include: wishInclude });
    });
    return FamilyWishResponseDto.fromEntity(wish);
  }

  async remove(userId: string, wishId: string): Promise<void> {
    const { familyId } = await this.membership.requirePartner(userId);
    const result = await this.prisma.familyWish.updateMany({
      where: { id: wishId, familyId, createdById: userId, deletedAt: null },
      data: { deletedAt: new Date(), version: { increment: 1 } },
    });
    if (result.count !== 1) throw new NotFoundException('Family wish not found');
  }

  accept(userId: string, wishId: string, expectedVersion?: number) {
    return this.respondToWish(userId, wishId, 'accept', expectedVersion);
  }
  reject(userId: string, wishId: string, expectedVersion?: number) {
    return this.respondToWish(userId, wishId, 'reject', expectedVersion);
  }

  async markRealized(userId: string, wishId: string, expectedVersion?: number) {
    const result = await this.transition(
      userId,
      wishId,
      expectedVersion,
      (wish) => {
        if (
          wish.partnerApprovalStatus !== FamilyWishApprovalStatus.ACCEPTED ||
          wish.implementationStatus !== FamilyWishImplementationStatus.NOT_REALIZED
        )
          throw new ConflictException('Only an accepted, unrealized wish can be marked realized');
        if (wish.createdById !== userId && wish.partnerId !== userId)
          throw new ForbiddenException('Only a wish partner can mark it realized');
        return {
          implementationStatus: FamilyWishImplementationStatus.REALIZED,
          realizationConfirmationStatus: FamilyWishRealizationConfirmationStatus.PENDING,
          realizedById: userId,
          realizedAt: new Date(),
        };
      },
      'FAMILY_WISH_MARKED_REALIZED',
    );
    return result;
  }

  confirmRealization(userId: string, wishId: string, expectedVersion?: number) {
    return this.respondToRealization(userId, wishId, true, expectedVersion);
  }
  rejectRealization(userId: string, wishId: string, expectedVersion?: number) {
    return this.respondToRealization(userId, wishId, false, expectedVersion);
  }

  private async respondToWish(
    userId: string,
    wishId: string,
    action: 'accept' | 'reject',
    expectedVersion?: number,
  ) {
    return this.transition(
      userId,
      wishId,
      expectedVersion,
      (wish) => {
        if (wish.partnerId !== userId)
          throw new ForbiddenException('Only the assigned partner can respond');
        if (wish.partnerApprovalStatus !== FamilyWishApprovalStatus.PENDING)
          throw new ConflictException('The wish was already answered');
        return action === 'accept'
          ? {
              partnerApprovalStatus: FamilyWishApprovalStatus.ACCEPTED,
              implementationStatus: FamilyWishImplementationStatus.NOT_REALIZED,
            }
          : { partnerApprovalStatus: FamilyWishApprovalStatus.REJECTED };
      },
      action === 'accept' ? 'FAMILY_WISH_ACCEPTED' : 'FAMILY_WISH_REJECTED',
    );
  }

  private async respondToRealization(
    userId: string,
    wishId: string,
    accepted: boolean,
    expectedVersion?: number,
  ) {
    return this.transition(
      userId,
      wishId,
      expectedVersion,
      (wish) => {
        if (wish.partnerId !== userId)
          throw new ForbiddenException('Only the assigned partner can confirm realization');
        if (wish.realizationConfirmationStatus !== FamilyWishRealizationConfirmationStatus.PENDING)
          throw new ConflictException('Realization is not awaiting confirmation');
        return accepted
          ? { realizationConfirmationStatus: FamilyWishRealizationConfirmationStatus.ACCEPTED }
          : {
              implementationStatus: FamilyWishImplementationStatus.NOT_REALIZED,
              realizationConfirmationStatus: FamilyWishRealizationConfirmationStatus.REJECTED,
            };
      },
      accepted ? 'FAMILY_WISH_REALIZATION_CONFIRMED' : 'FAMILY_WISH_REALIZATION_REJECTED',
    );
  }

  private async transition(
    userId: string,
    wishId: string,
    expectedVersion: number | undefined,
    decide: (wish: FamilyWishEntity) => Prisma.FamilyWishUpdateInput,
    notificationType: string,
  ) {
    const { familyId } = await this.membership.requirePartner(userId);
    const wish = await this.prisma.$transaction(async (tx) => {
      const current = await tx.familyWish.findFirst({
        where: { id: wishId, familyId, deletedAt: null },
        include: wishInclude,
      });
      if (!current) throw new NotFoundException('Family wish not found');
      const data = decide(current);
      const result = await tx.familyWish.updateMany({
        where: {
          id: wishId,
          familyId,
          deletedAt: null,
          ...(expectedVersion === undefined ? {} : { version: expectedVersion }),
        },
        data: { ...data, version: { increment: 1 } },
      });
      if (result.count !== 1) {
        if (expectedVersion !== undefined) throw new VersionConflictException(expectedVersion);
        throw new NotFoundException('Family wish not found');
      }
      const updated = await tx.familyWish.findFirstOrThrow({
        where: { id: wishId },
        include: wishInclude,
      });
      const recipientId = updated.createdById === userId ? updated.partnerId : updated.createdById;
      await this.notifications.notifyUserInTransaction(tx, {
        userId: recipientId,
        familyId,
        type: notificationType,
        title: 'Изменение семейного желания',
        body: updated.title,
      });
      return updated;
    });
    return FamilyWishResponseDto.fromEntity(wish);
  }

  private async requireWish(userId: string, wishId: string) {
    const { familyId } = await this.membership.requirePartner(userId);
    const wish = await this.prisma.familyWish.findFirst({
      where: { id: wishId, familyId, deletedAt: null },
      include: wishInclude,
    });
    if (!wish) throw new NotFoundException('Family wish not found');
    return wish;
  }

  private async resolveFamilyPartner(familyId: string, identifier: string): Promise<string> {
    const partner = await this.prisma.familyMember.findFirst({
      where: {
        familyId,
        role: FamilyMemberRole.PARTNER,
        family: { status: 'ACTIVE' },
        OR: [{ userId: identifier }, { id: identifier }],
      },
      select: { userId: true },
    });
    if (!partner)
      throw new ForbiddenException('The wish partner must be an active partner in your family');
    return partner.userId;
  }
}
