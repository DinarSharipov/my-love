import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { LedgerTransactionType, Prisma, WalletType } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../database/prisma.service';
import { FamilyMembershipService } from '../family-members/family-membership.service';
import {
  CreateLedgerCommandDto,
  CreateTransferCommandDto,
  ReverseLedgerTransactionDto,
} from './dto/ledger-command.dto';

const COMMAND_SCOPE = 'finance.ledger.v1';
const MAX_AMOUNT_MINOR = 9223372036854775807n;
const transactionInclude = { entries: { orderBy: { createdAt: 'asc' } } } as const;

type LedgerTransactionWithEntries = Prisma.LedgerTransactionGetPayload<{
  include: typeof transactionInclude;
}>;

@Injectable()
export class LedgerCommandsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: FamilyMembershipService,
    private readonly audit: AuditService,
  ) {}

  income(userId: string, key: string, dto: CreateLedgerCommandDto) {
    return this.createWalletCommand(userId, key, dto, LedgerTransactionType.INCOME);
  }

  expense(userId: string, key: string, dto: CreateLedgerCommandDto) {
    return this.createWalletCommand(userId, key, dto, LedgerTransactionType.EXPENSE);
  }

  async transfer(userId: string, key: string, dto: CreateTransferCommandDto) {
    if (dto.fromWalletId === dto.toWalletId) {
      throw new BadRequestException('Transfer wallets must be different');
    }
    const context = await this.membership.requireMembership(userId);
    const amount = this.amount(dto.amountMinor);
    const requestHash = this.requestHash('transfer', dto);
    const existing = await this.replay(userId, key, requestHash);
    if (existing) return existing;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const wallets = await tx.wallet.findMany({
          where: {
            id: { in: [dto.fromWalletId, dto.toWalletId] },
            familyId: context.familyId,
            archivedAt: null,
          },
        });
        const from = wallets.find((wallet) => wallet.id === dto.fromWalletId);
        const to = wallets.find((wallet) => wallet.id === dto.toWalletId);
        if (
          !from ||
          !to ||
          !this.canManage(from, userId, context.role) ||
          !this.canManage(to, userId, context.role)
        ) {
          throw new NotFoundException('Wallet not found');
        }
        if (from.currency !== to.currency)
          throw new BadRequestException('Transfer wallets must use the same currency');

        return this.persist(tx, userId, context.familyId, key, requestHash, {
          type: LedgerTransactionType.TRANSFER,
          currency: from.currency,
          occurredAt: this.occurredAt(dto.occurredAt),
          note: dto.note,
          entries: [
            { walletId: from.id, amountMinor: -amount },
            { walletId: to.id, amountMinor: amount },
          ],
        });
      });
    } catch (error: unknown) {
      return this.replayAfterConflict(userId, key, requestHash, error);
    }
  }

  async reverse(
    userId: string,
    transactionId: string,
    key: string,
    dto: ReverseLedgerTransactionDto,
  ) {
    const context = await this.membership.requireMembership(userId);
    const requestHash = this.requestHash('reversal', { transactionId, ...dto });
    const existing = await this.replay(userId, key, requestHash);
    if (existing) return existing;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const original = await tx.ledgerTransaction.findFirst({
          where: { id: transactionId, familyId: context.familyId },
          include: { ...transactionInclude, reversedBy: { select: { id: true } } },
        });
        if (!original) throw new NotFoundException('Ledger transaction not found');
        if (original.type === LedgerTransactionType.REVERSAL) {
          throw new BadRequestException('A reversal cannot be reversed');
        }
        if (original.reversesId || original.reversedBy) {
          throw new ConflictException('Ledger transaction was already reversed');
        }

        const walletIds = original.entries.flatMap((entry) =>
          entry.walletId ? [entry.walletId] : [],
        );
        const wallets = await tx.wallet.findMany({
          where: { id: { in: walletIds }, familyId: context.familyId, archivedAt: null },
        });
        if (
          wallets.length !== new Set(walletIds).size ||
          wallets.some((wallet) => !this.canManage(wallet, userId, context.role))
        ) {
          throw new NotFoundException('Ledger transaction not found');
        }

        return this.persist(tx, userId, context.familyId, key, requestHash, {
          type: LedgerTransactionType.REVERSAL,
          currency: original.currency,
          occurredAt: this.occurredAt(dto.occurredAt),
          note: dto.note,
          reversesId: original.id,
          entries: original.entries.map((entry) => ({
            walletId: entry.walletId,
            amountMinor: -entry.amountMinor,
          })),
        });
      });
    } catch (error: unknown) {
      return this.replayAfterConflict(
        userId,
        key,
        requestHash,
        error,
        'Ledger transaction was already reversed',
      );
    }
  }

  private async createWalletCommand(
    userId: string,
    key: string,
    dto: CreateLedgerCommandDto,
    type: 'INCOME' | 'EXPENSE',
  ) {
    const context = await this.membership.requireMembership(userId);
    const amount = this.amount(dto.amountMinor);
    const requestHash = this.requestHash(type.toLowerCase(), dto);
    const existing = await this.replay(userId, key, requestHash);
    if (existing) return existing;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const wallet = await tx.wallet.findFirst({
          where: { id: dto.walletId, familyId: context.familyId, archivedAt: null },
        });
        if (!wallet || !this.canManage(wallet, userId, context.role))
          throw new NotFoundException('Wallet not found');
        const walletAmount = type === LedgerTransactionType.INCOME ? amount : -amount;
        return this.persist(tx, userId, context.familyId, key, requestHash, {
          type,
          currency: wallet.currency,
          occurredAt: this.occurredAt(dto.occurredAt),
          note: dto.note,
          entries: [
            { walletId: wallet.id, amountMinor: walletAmount },
            { walletId: null, amountMinor: -walletAmount },
          ],
        });
      });
    } catch (error: unknown) {
      return this.replayAfterConflict(userId, key, requestHash, error);
    }
  }

  private async persist(
    tx: Prisma.TransactionClient,
    userId: string,
    familyId: string,
    key: string,
    requestHash: string,
    input: {
      type: LedgerTransactionType;
      currency: string;
      occurredAt: Date;
      note?: string;
      reversesId?: string;
      entries: Array<{ walletId: string | null; amountMinor: bigint }>;
    },
  ) {
    const transaction = await tx.ledgerTransaction.create({
      data: {
        familyId,
        createdById: userId,
        type: input.type,
        currency: input.currency,
        occurredAt: input.occurredAt,
        note: input.note,
        reversesId: input.reversesId,
        entries: { create: input.entries },
      },
      include: transactionInclude,
    });
    await tx.financialCommandResult.create({
      data: { userId, scope: COMMAND_SCOPE, key, requestHash, transactionId: transaction.id },
    });
    await this.audit.record(
      {
        actorId: userId,
        familyId,
        action: `ledger.${input.type.toLowerCase()}`,
        resourceType: 'ledger_transaction',
        resourceId: transaction.id,
      },
      tx,
    );
    return this.serialize(transaction);
  }

  private async replay(userId: string, key: string, requestHash: string) {
    const command = await this.prisma.financialCommandResult.findUnique({
      where: { userId_scope_key: { userId, scope: COMMAND_SCOPE, key } },
      include: { transaction: { include: transactionInclude } },
    });
    if (!command) return null;
    if (command.requestHash !== requestHash)
      throw new ConflictException('Idempotency-Key was already used with a different request');
    return this.serialize(command.transaction);
  }

  private async replayAfterConflict(
    userId: string,
    key: string,
    requestHash: string,
    error: unknown,
    uniqueConflictMessage?: string,
  ) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const replay = await this.replay(userId, key, requestHash);
      if (replay) return replay;
      if (uniqueConflictMessage) throw new ConflictException(uniqueConflictMessage);
    }
    throw error;
  }

  private canManage(
    wallet: { type: WalletType; ownerId: string | null },
    userId: string,
    role: string,
  ) {
    return wallet.ownerId === userId || (wallet.type === WalletType.FAMILY && role === 'PARTNER');
  }

  private amount(value: string): bigint {
    const amount = BigInt(value);
    if (amount > MAX_AMOUNT_MINOR) throw new BadRequestException('amountMinor is too large');
    return amount;
  }

  private occurredAt(value?: string): Date {
    return value ? new Date(value) : new Date();
  }

  private requestHash(command: string, dto: unknown): string {
    return createHash('sha256').update(JSON.stringify({ command, dto })).digest('hex');
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
