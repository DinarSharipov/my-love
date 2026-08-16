import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FinancialCategoryKind, Prisma } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../database/prisma.service';
import { FamilyMembershipService } from '../family-members/family-membership.service';
import { BudgetQueryDto, CreateBudgetDto, UpdateBudgetDto } from './dto/budget.dto';

const MAX_AMOUNT_MINOR = 9223372036854775807n;

@Injectable()
export class BudgetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: FamilyMembershipService,
    private readonly audit: AuditService,
  ) {}

  async create(userId: string, dto: CreateBudgetDto) {
    const context = await this.membership.requirePartner(userId);
    const periodStart = this.periodStart(dto.periodStart);
    const limitMinor = this.amount(dto.limitMinor);
    const category = await this.prisma.financialCategory.findFirst({
      where: {
        id: dto.categoryId,
        familyId: context.familyId,
        kind: FinancialCategoryKind.EXPENSE,
        archivedAt: null,
      },
    });
    if (!category) throw new NotFoundException('Expense financial category not found');
    try {
      return await this.prisma.$transaction(async (tx) => {
        const budget = await tx.budget.create({
          data: {
            familyId: context.familyId,
            categoryId: category.id,
            createdById: userId,
            periodStart,
            limitMinor,
          },
        });
        await this.audit.record(
          {
            actorId: userId,
            familyId: context.familyId,
            action: 'budget.created',
            resourceType: 'budget',
            resourceId: budget.id,
            metadata: { categoryId: category.id, periodStart: dto.periodStart },
          },
          tx,
        );
        return this.serialize(budget);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ConflictException('A budget for this category and month already exists');
      throw error;
    }
  }

  async list(userId: string, query: BudgetQueryDto) {
    const context = await this.membership.requireMembership(userId);
    const periodStart = query.periodStart ? this.periodStart(query.periodStart) : undefined;
    const values = await this.prisma.budget.findMany({
      where: { familyId: context.familyId, ...(periodStart ? { periodStart } : {}) },
      orderBy: [{ periodStart: 'desc' }, { createdAt: 'asc' }],
    });
    return values.map((budget) => this.serialize(budget));
  }

  async update(userId: string, budgetId: string, dto: UpdateBudgetDto, expectedVersion?: number) {
    const context = await this.membership.requirePartner(userId);
    const budget = await this.require(budgetId, context.familyId);
    const limitMinor = this.amount(dto.limitMinor);
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.budget.updateMany({
        where: { id: budget.id, version: expectedVersion ?? budget.version },
        data: { limitMinor, version: { increment: 1 } },
      });
      if (result.count !== 1) throw new ConflictException('Budget was changed concurrently');
      const updated = await tx.budget.findUniqueOrThrow({ where: { id: budget.id } });
      await this.audit.record(
        {
          actorId: userId,
          familyId: context.familyId,
          action: 'budget.updated',
          resourceType: 'budget',
          resourceId: budget.id,
        },
        tx,
      );
      return this.serialize(updated);
    });
  }

  async remove(userId: string, budgetId: string, expectedVersion?: number): Promise<void> {
    const context = await this.membership.requirePartner(userId);
    const budget = await this.require(budgetId, context.familyId);
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.budget.deleteMany({
        where: { id: budget.id, version: expectedVersion ?? budget.version },
      });
      if (result.count !== 1) throw new ConflictException('Budget was changed concurrently');
      await this.audit.record(
        {
          actorId: userId,
          familyId: context.familyId,
          action: 'budget.deleted',
          resourceType: 'budget',
          resourceId: budget.id,
        },
        tx,
      );
    });
  }

  private async require(id: string, familyId: string) {
    const budget = await this.prisma.budget.findFirst({ where: { id, familyId } });
    if (!budget) throw new NotFoundException('Budget not found');
    return budget;
  }

  private periodStart(value: string): Date {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value ||
      date.getUTCDate() !== 1
    )
      throw new BadRequestException('periodStart must be the first calendar day of a valid month');
    return date;
  }

  private amount(value: string): bigint {
    const amount = BigInt(value);
    if (amount > MAX_AMOUNT_MINOR) throw new BadRequestException('limitMinor is too large');
    return amount;
  }

  private serialize<T extends { limitMinor: bigint }>(budget: T) {
    return {
      ...budget,
      limitMinor: budget.limitMinor.toString(),
      periodStart: (budget as T & { periodStart: Date }).periodStart.toISOString().slice(0, 10),
    };
  }
}
