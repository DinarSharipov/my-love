import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { FamilyMemberRole, Prisma, WalletType, WalletVisibility } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { NotificationProducerService } from '../../common/notifications/notification-producer.service';
import { PrismaService } from '../../database/prisma.service';
import { FamilyMembershipService } from '../family-members/family-membership.service';
import {
  CreateFinancialGoalContributionDto,
  CreateFinancialGoalDto,
  UpdateFinancialGoalDto,
} from './dto/financial-goal.dto';
import { LedgerHistoryService } from './ledger-history.service';
import { WalletsService } from './wallets.service';

const COMMAND_SCOPE = 'finance.goal-contribution.v1';
const MAX_AMOUNT_MINOR = 9223372036854775807n;
const goalInclude = { wallet: true } as const;
type GoalWithWallet = Prisma.FinancialGoalGetPayload<{ include: typeof goalInclude }>;

@Injectable()
export class FinancialGoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: FamilyMembershipService,
    private readonly wallets: WalletsService,
    private readonly history: LedgerHistoryService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationProducerService,
  ) {}

  async create(userId: string, dto: CreateFinancialGoalDto) {
    const context = await this.membership.requireMembership(userId);
    const visibility = this.visibility(dto.type, dto.visibility);
    if (dto.type === WalletType.FAMILY && context.role !== FamilyMemberRole.PARTNER) {
      throw new ForbiddenException('A partner membership is required');
    }
    const targetDate = this.targetDate(dto.targetDate);
    const targetAmountMinor = this.amount(dto.targetAmountMinor, 'targetAmountMinor');
    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.create({
        data: {
          familyId: context.familyId,
          ownerId: dto.type === WalletType.PERSONAL ? userId : null,
          createdById: userId,
          type: dto.type,
          visibility,
          name: dto.title,
          currency: dto.currency ?? context.defaultCurrency,
        },
      });
      const goal = await tx.financialGoal.create({
        data: {
          familyId: context.familyId,
          walletId: wallet.id,
          createdById: userId,
          title: dto.title,
          targetAmountMinor,
          targetDate,
        },
        include: goalInclude,
      });
      await this.audit.record(
        {
          actorId: userId,
          familyId: context.familyId,
          action: 'financial_goal.created',
          resourceType: 'financial_goal',
          resourceId: goal.id,
        },
        tx,
      );
      return this.serialize(goal, 0n);
    });
  }

  async list(userId: string) {
    const context = await this.membership.requireMembership(userId);
    const goals = await this.prisma.financialGoal.findMany({
      where: {
        familyId: context.familyId,
        archivedAt: null,
        wallet: { archivedAt: null, ...this.wallets.visibleTo(userId, context.role) },
      },
      include: goalInclude,
      orderBy: { createdAt: 'asc' },
    });
    const visibleWhere = await this.history.visibleWhere(userId, context.familyId, context.role);
    const balances = await this.balances(
      goals.map((goal) => goal.walletId),
      visibleWhere,
    );
    return goals.map((goal) => this.serialize(goal, balances.get(goal.walletId) ?? 0n));
  }

  async update(userId: string, id: string, dto: UpdateFinancialGoalDto, expectedVersion?: number) {
    if (!Object.keys(dto).length)
      throw new BadRequestException('At least one field must be provided');
    const context = await this.membership.requireMembership(userId);
    const goal = await this.findManageable(userId, id, context.familyId, context.role);
    const targetAmountMinor =
      dto.targetAmountMinor === undefined
        ? goal.targetAmountMinor
        : this.amount(dto.targetAmountMinor, 'targetAmountMinor');
    const targetDate =
      dto.targetDate === undefined ? goal.targetDate : this.targetDate(dto.targetDate);
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.financialGoal.updateMany({
        where: { id: goal.id, archivedAt: null, version: expectedVersion ?? goal.version },
        data: { title: dto.title, targetAmountMinor, targetDate, version: { increment: 1 } },
      });
      if (result.count !== 1)
        throw new ConflictException('Financial goal was changed concurrently');
      if (dto.title !== undefined)
        await tx.wallet.update({
          where: { id: goal.walletId },
          data: { name: dto.title, version: { increment: 1 } },
        });
      const updated = await tx.financialGoal.findUniqueOrThrow({
        where: { id: goal.id },
        include: goalInclude,
      });
      await this.audit.record(
        {
          actorId: userId,
          familyId: context.familyId,
          action: 'financial_goal.updated',
          resourceType: 'financial_goal',
          resourceId: goal.id,
        },
        tx,
      );
      const balance = await this.balance(tx, goal.walletId);
      return this.serialize(updated, balance);
    });
  }

  async contribute(
    userId: string,
    id: string,
    key: string,
    dto: CreateFinancialGoalContributionDto,
  ) {
    const context = await this.membership.requireMembership(userId);
    const requestHash = this.requestHash(id, dto);
    const replay = await this.replay(userId, key, requestHash);
    if (replay) return replay;
    const amountMinor = this.amount(dto.amountMinor, 'amountMinor');
    try {
      return await this.prisma.$transaction(async (tx) => {
        const goal = await tx.financialGoal.findFirst({
          where: { id, familyId: context.familyId, archivedAt: null },
          include: goalInclude,
        });
        if (!goal || !this.canManage(goal.wallet, userId, context.role))
          throw new NotFoundException('Financial goal not found');
        if (dto.fromWalletId === goal.walletId)
          throw new BadRequestException('Contribution source wallet must differ from the envelope');
        const source = await tx.wallet.findFirst({
          where: { id: dto.fromWalletId, familyId: context.familyId, archivedAt: null },
        });
        if (!source || !this.canManage(source, userId, context.role))
          throw new NotFoundException('Wallet not found');
        if (source.currency !== goal.wallet.currency)
          throw new BadRequestException('Contribution wallets must use the same currency');
        if (
          goal.wallet.type === WalletType.FAMILY &&
          source.type === WalletType.PERSONAL &&
          source.visibility === WalletVisibility.PRIVATE
        ) {
          throw new BadRequestException('A private wallet cannot fund a family envelope');
        }
        const transaction = await tx.ledgerTransaction.create({
          data: {
            familyId: context.familyId,
            createdById: userId,
            type: 'TRANSFER',
            currency: source.currency,
            occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
            note: dto.note?.trim() || null,
            entries: {
              create: [
                { walletId: source.id, amountMinor: -amountMinor },
                { walletId: goal.walletId, amountMinor },
              ],
            },
          },
        });
        const contribution = await tx.financialGoalContribution.create({
          data: { goalId: goal.id, transactionId: transaction.id, createdById: userId },
        });
        await tx.financialCommandResult.create({
          data: { userId, scope: COMMAND_SCOPE, key, requestHash, transactionId: transaction.id },
        });
        const currentAmountMinor = await this.balance(tx, goal.walletId);
        const achievedAt =
          !goal.achievedAt && currentAmountMinor >= goal.targetAmountMinor
            ? new Date()
            : goal.achievedAt;
        if (achievedAt && !goal.achievedAt) {
          await tx.financialGoal.update({ where: { id: goal.id }, data: { achievedAt } });
          await this.notifications.notifyUserInTransaction(tx, {
            userId,
            familyId: context.familyId,
            type: 'FINANCIAL_GOAL_ACHIEVED',
            title: 'Цель достигнута',
            body: goal.title,
          });
        }
        await this.audit.record(
          {
            actorId: userId,
            familyId: context.familyId,
            action: 'financial_goal.contributed',
            resourceType: 'financial_goal',
            resourceId: goal.id,
          },
          tx,
        );
        return {
          id: contribution.id,
          goalId: goal.id,
          transactionId: transaction.id,
          amountMinor: amountMinor.toString(),
          occurredAt: transaction.occurredAt,
          currentAmountMinor: currentAmountMinor.toString(),
          achievedAt,
        };
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const afterConflict = await this.replay(userId, key, requestHash);
        if (afterConflict) return afterConflict;
      }
      throw error;
    }
  }

  async archive(userId: string, id: string, expectedVersion?: number): Promise<void> {
    const context = await this.membership.requireMembership(userId);
    const goal = await this.findManageable(userId, id, context.familyId, context.role);
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.financialGoal.updateMany({
        where: { id: goal.id, archivedAt: null, version: expectedVersion ?? goal.version },
        data: { archivedAt: new Date(), version: { increment: 1 } },
      });
      if (result.count !== 1)
        throw new ConflictException('Financial goal was changed concurrently');
      await this.audit.record(
        {
          actorId: userId,
          familyId: context.familyId,
          action: 'financial_goal.archived',
          resourceType: 'financial_goal',
          resourceId: goal.id,
        },
        tx,
      );
    });
  }

  private async findManageable(
    userId: string,
    id: string,
    familyId: string,
    role: FamilyMemberRole,
  ) {
    const goal = await this.prisma.financialGoal.findFirst({
      where: { id, familyId, archivedAt: null },
      include: goalInclude,
    });
    if (!goal || !this.canManage(goal.wallet, userId, role))
      throw new NotFoundException('Financial goal not found');
    return goal;
  }
  private canManage(
    wallet: { type: WalletType; ownerId: string | null },
    userId: string,
    role: FamilyMemberRole,
  ) {
    return (
      wallet.ownerId === userId ||
      (wallet.type === WalletType.FAMILY && role === FamilyMemberRole.PARTNER)
    );
  }
  private visibility(type: WalletType, visibility?: WalletVisibility) {
    const result =
      visibility ??
      (type === WalletType.FAMILY ? WalletVisibility.FAMILY : WalletVisibility.PRIVATE);
    if (
      (type === WalletType.FAMILY && result !== WalletVisibility.FAMILY) ||
      (type === WalletType.PERSONAL && result === WalletVisibility.FAMILY)
    )
      throw new BadRequestException('Visibility is incompatible with wallet type');
    return result;
  }
  private amount(value: string, field: string) {
    const amount = BigInt(value);
    if (amount > MAX_AMOUNT_MINOR) throw new BadRequestException(`${field} is too large`);
    return amount;
  }
  private targetDate(value: string | null | undefined) {
    if (value === undefined || value === null) return null;
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value)
      throw new BadRequestException('targetDate must be a valid calendar date');
    return date;
  }
  private async balance(
    tx: Pick<PrismaService, 'ledgerEntry'> | Prisma.TransactionClient,
    walletId: string,
  ) {
    const result = await tx.ledgerEntry.aggregate({
      where: { walletId },
      _sum: { amountMinor: true },
    });
    return result._sum.amountMinor ?? 0n;
  }
  private async balances(walletIds: string[], visibleWhere: Prisma.LedgerTransactionWhereInput) {
    const entries = await this.prisma.ledgerEntry.findMany({
      where: { walletId: { in: walletIds }, transaction: visibleWhere },
      select: { walletId: true, amountMinor: true },
    });
    return entries.reduce((result, entry) => {
      if (entry.walletId)
        result.set(entry.walletId, (result.get(entry.walletId) ?? 0n) + entry.amountMinor);
      return result;
    }, new Map<string, bigint>());
  }
  private serialize(goal: GoalWithWallet, currentAmountMinor: bigint) {
    return {
      id: goal.id,
      title: goal.title,
      targetAmountMinor: goal.targetAmountMinor.toString(),
      currentAmountMinor: currentAmountMinor.toString(),
      remainingAmountMinor: (goal.targetAmountMinor > currentAmountMinor
        ? goal.targetAmountMinor - currentAmountMinor
        : 0n
      ).toString(),
      currency: goal.wallet.currency,
      targetDate: goal.targetDate?.toISOString().slice(0, 10) ?? null,
      achievedAt: goal.achievedAt,
      archived: goal.archivedAt !== null,
      version: goal.version,
      envelope: {
        walletId: goal.walletId,
        type: goal.wallet.type,
        visibility: goal.wallet.visibility,
      },
    };
  }
  private requestHash(goalId: string, dto: unknown) {
    return createHash('sha256')
      .update(JSON.stringify({ command: 'goal-contribution', goalId, dto }))
      .digest('hex');
  }
  private async replay(userId: string, key: string, requestHash: string) {
    const command = await this.prisma.financialCommandResult.findUnique({
      where: { userId_scope_key: { userId, scope: COMMAND_SCOPE, key } },
      include: {
        transaction: {
          include: {
            entries: { select: { walletId: true, amountMinor: true } },
            goalContribution: { include: { goal: { include: goalInclude } } },
          },
        },
      },
    });
    if (!command) return null;
    if (command.requestHash !== requestHash)
      throw new ConflictException('Idempotency-Key was already used with a different request');
    const contribution = command.transaction.goalContribution;
    if (!contribution) throw new ConflictException('Goal contribution result is unavailable');
    const currentAmountMinor = await this.balance(this.prisma, contribution.goal.walletId);
    const amountMinor =
      command.transaction.entries.find((entry) => entry.walletId === contribution.goal.walletId)
        ?.amountMinor ?? 0n;
    return {
      id: contribution.id,
      goalId: contribution.goalId,
      transactionId: command.transactionId,
      amountMinor: amountMinor.toString(),
      occurredAt: command.transaction.occurredAt,
      currentAmountMinor: currentAmountMinor.toString(),
      achievedAt: contribution.goal.achievedAt,
    };
  }
}
