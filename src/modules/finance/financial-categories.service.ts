import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FamilyMemberRole, FinancialCategoryKind } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../database/prisma.service';
import { FamilyMembershipService } from '../family-members/family-membership.service';
import {
  CreateFinancialCategoryDto,
  UpdateFinancialCategoryDto,
} from './dto/financial-category.dto';

@Injectable()
export class FinancialCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: FamilyMembershipService,
    private readonly audit: AuditService,
  ) {}

  async create(userId: string, dto: CreateFinancialCategoryDto) {
    const context = await this.membership.requireMembership(userId);
    return this.prisma.$transaction(async (tx) => {
      const category = await tx.financialCategory.create({
        data: { familyId: context.familyId, createdById: userId, name: dto.name, kind: dto.kind },
      });
      await this.audit.record(
        {
          actorId: userId,
          familyId: context.familyId,
          action: 'financial_category.created',
          resourceType: 'financial_category',
          resourceId: category.id,
          metadata: { kind: category.kind },
        },
        tx,
      );
      return category;
    });
  }

  async list(userId: string, kind?: FinancialCategoryKind) {
    const context = await this.membership.requireMembership(userId);
    if (kind && !Object.values(FinancialCategoryKind).includes(kind)) {
      throw new BadRequestException('Invalid financial category kind');
    }
    return this.prisma.financialCategory.findMany({
      where: { familyId: context.familyId, archivedAt: null, ...(kind ? { kind } : {}) },
      orderBy: [{ kind: 'asc' }, { name: 'asc' }],
    });
  }

  async update(
    userId: string,
    categoryId: string,
    dto: UpdateFinancialCategoryDto,
    expectedVersion?: number,
  ) {
    const context = await this.membership.requireMembership(userId);
    const category = await this.active(categoryId, context.familyId);
    this.requireManage(category, userId, context.role);
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.financialCategory.updateMany({
        where: { id: category.id, version: expectedVersion ?? category.version, archivedAt: null },
        data: { ...(dto.name === undefined ? {} : { name: dto.name }), version: { increment: 1 } },
      });
      if (updated.count !== 1)
        throw new ConflictException('Financial category was changed concurrently');
      const value = await tx.financialCategory.findUniqueOrThrow({ where: { id: category.id } });
      await this.audit.record(
        {
          actorId: userId,
          familyId: context.familyId,
          action: 'financial_category.updated',
          resourceType: 'financial_category',
          resourceId: category.id,
        },
        tx,
      );
      return value;
    });
    return result;
  }

  async archive(userId: string, categoryId: string, expectedVersion?: number): Promise<void> {
    const context = await this.membership.requireMembership(userId);
    const category = await this.active(categoryId, context.familyId);
    this.requireManage(category, userId, context.role);
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.financialCategory.updateMany({
        where: { id: category.id, version: expectedVersion ?? category.version, archivedAt: null },
        data: { archivedAt: new Date(), version: { increment: 1 } },
      });
      if (result.count !== 1)
        throw new ConflictException('Financial category was changed concurrently');
      await this.audit.record(
        {
          actorId: userId,
          familyId: context.familyId,
          action: 'financial_category.archived',
          resourceType: 'financial_category',
          resourceId: category.id,
        },
        tx,
      );
    });
  }

  async active(categoryId: string, familyId: string) {
    const category = await this.prisma.financialCategory.findFirst({
      where: { id: categoryId, familyId, archivedAt: null },
    });
    if (!category) throw new NotFoundException('Financial category not found');
    return category;
  }

  private requireManage(category: { createdById: string }, userId: string, role: FamilyMemberRole) {
    if (category.createdById !== userId && role !== FamilyMemberRole.PARTNER) {
      throw new NotFoundException('Financial category not found');
    }
  }
}
