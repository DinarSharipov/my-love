import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginationMeta } from '../../common/dto/pagination-response.dto';
import { PrismaService } from '../../database/prisma.service';
import { FamilyMembershipService } from '../family-members/family-membership.service';
import { LedgerHistoryQueryDto } from './dto/ledger-history-query.dto';
import { WalletsService } from './wallets.service';

const transactionInclude = { entries: { orderBy: { createdAt: 'asc' } } } as const;

type LedgerTransactionWithEntries = Prisma.LedgerTransactionGetPayload<{
  include: typeof transactionInclude;
}>;

@Injectable()
export class LedgerHistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: FamilyMembershipService,
    private readonly wallets: WalletsService,
  ) {}

  async list(userId: string, query: LedgerHistoryQueryDto) {
    const context = await this.membership.requireMembership(userId);
    const where = await this.visibleWhere(userId, context.familyId, context.role, query.walletId);
    const [total, transactions] = await this.prisma.$transaction([
      this.prisma.ledgerTransaction.count({ where }),
      this.prisma.ledgerTransaction.findMany({
        where,
        include: transactionInclude,
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);
    return {
      data: transactions.map((transaction) => this.serialize(transaction)),
      ...paginationMeta(total, query.page, query.limit),
    };
  }

  async get(userId: string, transactionId: string) {
    const context = await this.membership.requireMembership(userId);
    const where = await this.visibleWhere(userId, context.familyId, context.role);
    const transaction = await this.prisma.ledgerTransaction.findFirst({
      where: { ...where, id: transactionId },
      include: transactionInclude,
    });
    if (!transaction) throw new NotFoundException('Ledger transaction not found');
    return this.serialize(transaction);
  }

  /**
   * Shared visibility predicate for finance read models. A transaction is readable
   * only when every wallet entry belongs to a wallet visible to the caller.
   */
  async visibleWhere(
    userId: string,
    familyId: string,
    role: Parameters<WalletsService['visibleTo']>[1],
    walletId?: string,
  ): Promise<Prisma.LedgerTransactionWhereInput> {
    const visibleWallets = await this.prisma.wallet.findMany({
      where: { familyId, ...this.wallets.visibleTo(userId, role) },
      select: { id: true },
    });
    const visibleWalletIds = visibleWallets.map((wallet) => wallet.id);
    return {
      familyId,
      entries: {
        none: {
          AND: [{ walletId: { not: null } }, { walletId: { notIn: visibleWalletIds } }],
        },
        ...(walletId ? { some: { walletId } } : {}),
      },
    };
  }

  private serialize(transaction: LedgerTransactionWithEntries) {
    return {
      ...transaction,
      entries: transaction.entries.map((entry) => ({
        ...entry,
        amountMinor: entry.amountMinor.toString(),
      })),
    };
  }
}
