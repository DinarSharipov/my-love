import { BadRequestException, Injectable } from '@nestjs/common';
import { LedgerTransactionType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { FamilyMembershipService } from '../family-members/family-membership.service';
import { FinancialSummaryQueryDto } from './dto/financial-summary.dto';
import { LedgerHistoryService } from './ledger-history.service';

@Injectable()
export class FinancialSummaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: FamilyMembershipService,
    private readonly history: LedgerHistoryService,
  ) {}

  async get(userId: string, query: FinancialSummaryQueryDto) {
    const context = await this.membership.requireMembership(userId);
    const periodStart = this.periodStart(query.periodStart);
    const periodEnd = new Date(periodStart);
    periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);
    const visibleWhere = await this.history.visibleWhere(userId, context.familyId, context.role);

    const [categories, budgets, transactions] = await this.prisma.$transaction([
      this.prisma.financialCategory.findMany({
        where: { familyId: context.familyId },
        orderBy: [{ kind: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.budget.findMany({
        where: { familyId: context.familyId, periodStart },
      }),
      this.prisma.ledgerTransaction.findMany({
        where: {
          ...visibleWhere,
          categoryId: { not: null },
          type: {
            in: [
              LedgerTransactionType.INCOME,
              LedgerTransactionType.EXPENSE,
              LedgerTransactionType.REVERSAL,
            ],
          },
          occurredAt: { gte: periodStart, lt: periodEnd },
        },
        select: {
          categoryId: true,
          currency: true,
          entries: { select: { walletId: true, amountMinor: true } },
        },
      }),
    ]);

    const amounts = new Map<string, Map<string, bigint>>();
    for (const transaction of transactions) {
      if (!transaction.categoryId) continue;
      const walletAmount = transaction.entries.reduce(
        (total, entry) => total + (entry.walletId ? entry.amountMinor : 0n),
        0n,
      );
      const category = categories.find((value) => value.id === transaction.categoryId);
      if (!category) continue;
      const amount = category.kind === 'EXPENSE' ? -walletAmount : walletAmount;
      const byCurrency = amounts.get(category.id) ?? new Map<string, bigint>();
      byCurrency.set(transaction.currency, (byCurrency.get(transaction.currency) ?? 0n) + amount);
      amounts.set(category.id, byCurrency);
    }
    const budgetsByCategory = new Map(budgets.map((budget) => [budget.categoryId, budget]));

    return {
      periodStart: periodStart.toISOString().slice(0, 10),
      defaultCurrency: context.defaultCurrency,
      categories: categories.map((category) => {
        const actual = [...(amounts.get(category.id) ?? new Map<string, bigint>())]
          .filter(([, amountMinor]) => amountMinor !== 0n)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([currency, amountMinor]) => ({ currency, amountMinor: amountMinor.toString() }));
        const budget = budgetsByCategory.get(category.id);
        const defaultCurrencyActual = amounts.get(category.id)?.get(context.defaultCurrency) ?? 0n;
        return {
          id: category.id,
          name: category.name,
          kind: category.kind,
          archived: category.archivedAt !== null,
          actual,
          budget: budget
            ? {
                id: budget.id,
                limitMinor: budget.limitMinor.toString(),
                actualMinor: defaultCurrencyActual.toString(),
                remainingMinor: (budget.limitMinor - defaultCurrencyActual).toString(),
                version: budget.version,
              }
            : null,
        };
      }),
    };
  }

  private periodStart(value?: string): Date {
    const resolved = value ?? new Date().toISOString().slice(0, 7).concat('-01');
    const date = new Date(`${resolved}T00:00:00.000Z`);
    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== resolved ||
      date.getUTCDate() !== 1
    ) {
      throw new BadRequestException('periodStart must be the first calendar day of a valid month');
    }
    return date;
  }
}
