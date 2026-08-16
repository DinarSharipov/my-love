import { BadRequestException, Injectable } from '@nestjs/common';
import { LedgerTransactionType, RecurringPaymentFrequency } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { FamilyMembershipService } from '../family-members/family-membership.service';
import { FinancialAnalyticsQueryDto } from './dto/financial-analytics.dto';
import { LedgerHistoryService } from './ledger-history.service';
import { WalletsService } from './wallets.service';

type Amounts = Map<string, { income: bigint; expense: bigint }>;

@Injectable()
export class FinancialAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: FamilyMembershipService,
    private readonly history: LedgerHistoryService,
    private readonly wallets: WalletsService,
  ) {}

  async get(userId: string, query: FinancialAnalyticsQueryDto, now = new Date()) {
    const context = await this.membership.requireMembership(userId);
    const periodStart = this.periodStart(query.periodStart);
    const months = query.months ?? 6;
    const periodEnd = this.addMonths(periodStart, months);
    const forecastThrough = new Date(now.getTime() + (query.forecastDays ?? 30) * 86_400_000);
    const visibleWhere = await this.history.visibleWhere(userId, context.familyId, context.role);
    const walletVisibility = this.wallets.visibleTo(userId, context.role);
    const [transactions, payments, entries] = await this.prisma.$transaction([
      this.prisma.ledgerTransaction.findMany({
        where: {
          ...visibleWhere,
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
          occurredAt: true,
          currency: true,
          entries: { select: { walletId: true, amountMinor: true } },
        },
      }),
      this.prisma.recurringPayment.findMany({
        where: {
          familyId: context.familyId,
          active: true,
          archivedAt: null,
          wallet: { archivedAt: null, ...walletVisibility },
        },
        select: {
          type: true,
          amountMinor: true,
          frequency: true,
          interval: true,
          nextDueAt: true,
          wallet: { select: { currency: true } },
        },
      }),
      this.prisma.ledgerEntry.findMany({
        where: {
          wallet: { familyId: context.familyId, ...walletVisibility },
          transaction: visibleWhere,
        },
        select: { walletId: true, amountMinor: true, wallet: { select: { currency: true } } },
      }),
    ]);

    const actualByMonth = new Map<string, Amounts>();
    for (const transaction of transactions) {
      const amount = transaction.entries.reduce(
        (total, entry) => total + (entry.walletId ? entry.amountMinor : 0n),
        0n,
      );
      this.add(actualByMonth, this.monthKey(transaction.occurredAt), transaction.currency, amount);
    }

    const mandatoryByMonth = new Map<string, Amounts>();
    const forecastAmounts: Amounts = new Map();
    for (const payment of payments) {
      for (const dueAt of this.occurrences(payment, periodStart, periodEnd)) {
        this.add(
          mandatoryByMonth,
          this.monthKey(dueAt),
          payment.wallet.currency,
          payment.type === 'INCOME' ? payment.amountMinor : -payment.amountMinor,
        );
      }
      const forecastOccurrences = this.occurrences(payment, now, forecastThrough);
      for (let index = 0; index < forecastOccurrences.length; index += 1) {
        this.addAmount(
          forecastAmounts,
          payment.wallet.currency,
          payment.type === 'INCOME' ? payment.amountMinor : -payment.amountMinor,
        );
      }
    }

    const balances = new Map<string, bigint>();
    for (const entry of entries) {
      if (!entry.wallet) continue;
      balances.set(
        entry.wallet.currency,
        (balances.get(entry.wallet.currency) ?? 0n) + entry.amountMinor,
      );
    }
    const currencies = new Set([...balances.keys(), ...forecastAmounts.keys()]);

    return {
      periodStart: this.monthKey(periodStart),
      months,
      cashFlow: Array.from({ length: months }, (_, index) => {
        const month = this.addMonths(periodStart, index);
        const key = this.monthKey(month);
        return {
          periodStart: key,
          actual: this.serialize(
            actualByMonth.get(key) ?? new Map<string, { income: bigint; expense: bigint }>(),
          ),
          mandatory: this.serialize(
            mandatoryByMonth.get(key) ?? new Map<string, { income: bigint; expense: bigint }>(),
          ),
        };
      }),
      forecastAsOf: now,
      forecastThrough,
      balanceForecast: [...currencies].sort().map((currency) => {
        const current = balances.get(currency) ?? 0n;
        const planned = forecastAmounts.get(currency) ?? { income: 0n, expense: 0n };
        return {
          currency,
          currentBalanceMinor: current.toString(),
          plannedIncomeMinor: planned.income.toString(),
          plannedExpenseMinor: planned.expense.toString(),
          projectedBalanceMinor: (current + planned.income - planned.expense).toString(),
        };
      }),
    };
  }

  private occurrences(
    payment: { nextDueAt: Date; frequency: RecurringPaymentFrequency; interval: number },
    start: Date,
    end: Date,
  ) {
    const dates: Date[] = [];
    let dueAt = new Date(payment.nextDueAt);
    while (dueAt < start) dueAt = this.nextDueAt(dueAt, payment.frequency, payment.interval);
    while (dueAt < end) {
      dates.push(dueAt);
      dueAt = this.nextDueAt(dueAt, payment.frequency, payment.interval);
    }
    return dates;
  }

  private nextDueAt(current: Date, frequency: RecurringPaymentFrequency, interval: number) {
    const next = new Date(current);
    if (frequency === 'WEEKLY') next.setUTCDate(next.getUTCDate() + interval * 7);
    else next.setUTCMonth(next.getUTCMonth() + interval);
    return next;
  }

  private add(target: Map<string, Amounts>, month: string, currency: string, amount: bigint) {
    const values = target.get(month) ?? new Map<string, { income: bigint; expense: bigint }>();
    this.addAmount(values, currency, amount);
    target.set(month, values);
  }

  private addAmount(target: Amounts, currency: string, amount: bigint) {
    const current = target.get(currency) ?? { income: 0n, expense: 0n };
    if (amount >= 0n) current.income += amount;
    else current.expense -= amount;
    target.set(currency, current);
  }

  private serialize(values: Amounts) {
    return [...values]
      .filter(([, amount]) => amount.income !== 0n || amount.expense !== 0n)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([currency, amount]) => ({
        currency,
        incomeMinor: amount.income.toString(),
        expenseMinor: amount.expense.toString(),
        netMinor: (amount.income - amount.expense).toString(),
      }));
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

  private addMonths(date: Date, months: number) {
    const result = new Date(date);
    result.setUTCMonth(result.getUTCMonth() + months);
    return result;
  }

  private monthKey(date: Date) {
    return date.toISOString().slice(0, 7).concat('-01');
  }
}
