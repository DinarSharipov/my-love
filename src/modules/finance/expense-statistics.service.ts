import { BadRequestException, Injectable } from '@nestjs/common';
import { LedgerTransactionType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { FamilyMembershipService } from '../family-members/family-membership.service';
import { ExpenseStatisticsQueryDto } from './dto/expense-statistics.dto';

type Amounts = Map<string, bigint>;
type CategoryTotals = { id: string | null; name: string; totals: Amounts };
type MemberTotals = {
  firstName: string;
  lastName: string;
  totals: Amounts;
  categories: Map<string, CategoryTotals>;
};

@Injectable()
export class ExpenseStatisticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: FamilyMembershipService,
  ) {}

  async get(userId: string, query: ExpenseStatisticsQueryDto) {
    const context = await this.membership.requirePartner(userId);
    const range = this.range(query);
    const transactions = await this.prisma.ledgerTransaction.findMany({
      where: {
        familyId: context.familyId,
        type: { in: [LedgerTransactionType.EXPENSE, LedgerTransactionType.REVERSAL] },
        ...(range ? { occurredAt: range } : {}),
      },
      select: {
        type: true,
        currency: true,
        categoryId: true,
        createdById: true,
        entries: { select: { walletId: true, amountMinor: true } },
        category: { select: { name: true } },
        createdBy: { select: { firstName: true, lastName: true } },
        reverses: {
          select: {
            type: true,
            createdById: true,
            categoryId: true,
            category: { select: { name: true } },
          },
        },
      },
    });

    const total = new Map<string, bigint>();
    const members = new Map<string, MemberTotals>();

    for (const transaction of transactions) {
      if (
        transaction.type === LedgerTransactionType.REVERSAL &&
        transaction.reverses?.type !== LedgerTransactionType.EXPENSE
      )
        continue;
      const amount = -transaction.entries.reduce(
        (sum, entry) => sum + (entry.walletId ? entry.amountMinor : 0n),
        0n,
      );
      if (amount === 0n) continue;
      const original = transaction.reverses;
      const ownerId = original?.createdById ?? transaction.createdById;
      const categoryId = original?.categoryId ?? transaction.categoryId;
      const categoryName =
        original?.category?.name ?? transaction.category?.name ?? 'Без категории';
      this.add(total, transaction.currency, amount);
      const member: MemberTotals = members.get(ownerId) ?? {
        firstName: transaction.createdBy.firstName,
        lastName: transaction.createdBy.lastName,
        totals: new Map<string, bigint>(),
        categories: new Map<string, CategoryTotals>(),
      };
      this.add(member.totals, transaction.currency, amount);
      const categoryKey = categoryId ?? 'uncategorized';
      const category: CategoryTotals = member.categories.get(categoryKey) ?? {
        id: categoryId,
        name: categoryName,
        totals: new Map<string, bigint>(),
      };
      this.add(category.totals, transaction.currency, amount);
      member.categories.set(categoryKey, category);
      members.set(ownerId, member);
    }

    return {
      dateFrom: query.dateFrom ?? null,
      dateTo: query.dateTo ?? null,
      totals: this.serialize(total),
      members: [...members]
        .sort(([, left], [, right]) =>
          `${left.firstName} ${left.lastName}`.localeCompare(
            `${right.firstName} ${right.lastName}`,
          ),
        )
        .map(([memberId, member]) => ({
          userId: memberId,
          firstName: member.firstName,
          lastName: member.lastName,
          totals: this.serialize(member.totals),
          categories: [...member.categories.values()]
            .sort((left, right) => left.name.localeCompare(right.name))
            .map((category) => ({
              categoryId: category.id,
              name: category.name,
              totals: this.serialize(category.totals),
            })),
        })),
    };
  }

  private range(query: ExpenseStatisticsQueryDto) {
    const from = query.dateFrom ? this.date(query.dateFrom, 'dateFrom') : undefined;
    const to = query.dateTo ? this.date(query.dateTo, 'dateTo') : undefined;
    if (from && to && from > to) throw new BadRequestException('dateFrom must not be after dateTo');
    if (!from && !to) return undefined;
    const endExclusive = to ? new Date(to) : undefined;
    if (endExclusive) endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    return { ...(from ? { gte: from } : {}), ...(endExclusive ? { lt: endExclusive } : {}) };
  }

  private date(value: string, field: string) {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      throw new BadRequestException(`${field} must be a valid calendar date`);
    }
    return date;
  }

  private add(amounts: Amounts, currency: string, amount: bigint) {
    amounts.set(currency, (amounts.get(currency) ?? 0n) + amount);
  }

  private serialize(amounts: Amounts) {
    return [...amounts]
      .filter(([, amount]) => amount !== 0n)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([currency, amountMinor]) => ({ currency, amountMinor: amountMinor.toString() }));
  }
}
