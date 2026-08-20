import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FamilyMemberRole, Prisma, RecurringPaymentType, WalletType } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../database/prisma.service';
import { FamilyMembershipService } from '../family-members/family-membership.service';
import { CreateRecurringPaymentDto, UpdateRecurringPaymentDto } from './dto/recurring-payment.dto';
import { WalletsService } from './wallets.service';

const MAX_AMOUNT_MINOR = 9223372036854775807n;

@Injectable()
export class RecurringPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: FamilyMembershipService,
    private readonly wallets: WalletsService,
    private readonly audit: AuditService,
  ) {}

  async create(userId: string, dto: CreateRecurringPaymentDto) {
    const context = await this.membership.requireMembership(userId);
    const dueAt = this.futureDate(dto.nextDueAt);
    const amountMinor = this.amount(dto.amountMinor);
    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findFirst({
        where: { id: dto.walletId, familyId: context.familyId, archivedAt: null },
      });
      if (!wallet || !this.canManage(wallet, userId, context.role))
        throw new NotFoundException('Wallet not found');
      await this.validateCategory(tx, context.familyId, dto.categoryId, dto.type);
      const recipients = await this.recipients(
        tx,
        context.familyId,
        wallet,
        userId,
        context.role,
        dto.reminderRecipientIds ?? [userId],
      );
      const payment = await tx.recurringPayment.create({
        data: {
          familyId: context.familyId,
          walletId: wallet.id,
          categoryId: dto.categoryId,
          createdById: userId,
          type: dto.type,
          title: dto.title.trim(),
          note: dto.note?.trim() || null,
          amountMinor,
          frequency: dto.frequency,
          interval: dto.interval ?? 1,
          nextDueAt: dueAt,
          reminderOffsetMinutes: dto.reminderOffsetMinutes,
          reminderRecipientIds: recipients,
        },
      });
      await tx.recurringPaymentForecast.create({
        data: {
          recurringPaymentId: payment.id,
          dueAt,
          reminderAt: this.reminderAt(dueAt, dto.reminderOffsetMinutes),
        },
      });
      await this.audit.record(
        {
          actorId: userId,
          familyId: context.familyId,
          action: 'recurring_payment.created',
          resourceType: 'recurring_payment',
          resourceId: payment.id,
        },
        tx,
      );
      return this.serialize(payment);
    });
  }

  async list(userId: string) {
    const { familyId, role } = await this.membership.requireMembership(userId);
    const payments = await this.prisma.recurringPayment.findMany({
      where: {
        familyId,
        archivedAt: null,
        wallet: { archivedAt: null, ...this.wallets.visibleTo(userId, role) },
      },
      orderBy: [{ nextDueAt: 'asc' }, { createdAt: 'asc' }],
    });
    return payments.map((payment) => this.serialize(payment));
  }

  async listArchived(userId: string) {
    const { familyId, role } = await this.membership.requireMembership(userId);
    const payments = await this.prisma.recurringPayment.findMany({
      where: {
        familyId,
        archivedAt: { not: null },
        wallet: { archivedAt: null, ...this.wallets.visibleTo(userId, role) },
      },
      orderBy: [{ archivedAt: 'desc' }, { createdAt: 'asc' }],
    });
    return payments.map((payment) => this.serialize(payment));
  }

  async listForecasts(userId: string, id: string) {
    const payment = await this.findVisible(userId, id);
    const forecasts = await this.prisma.recurringPaymentForecast.findMany({
      where: { recurringPaymentId: payment.id },
      orderBy: { dueAt: 'asc' },
      take: 50,
    });
    return forecasts.map((forecast) => ({
      id: forecast.id,
      dueAt: forecast.dueAt,
      reminderAt: forecast.reminderAt,
      reminderSentAt: forecast.reminderSentAt,
    }));
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateRecurringPaymentDto,
    expectedVersion?: number,
  ) {
    const context = await this.membership.requireMembership(userId);
    const current = await this.findManageable(userId, id, context.familyId, context.role);
    if (!Object.keys(dto).length)
      throw new BadRequestException('At least one field must be provided');
    const dueAt = dto.nextDueAt ? this.futureDate(dto.nextDueAt) : current.nextDueAt;
    const type = current.type;
    return this.prisma.$transaction(async (tx) => {
      await this.validateCategory(tx, context.familyId, dto.categoryId, type);
      const wallet = await tx.wallet.findFirstOrThrow({
        where: { id: current.walletId, familyId: context.familyId, archivedAt: null },
      });
      const recipients =
        dto.reminderRecipientIds === undefined
          ? current.reminderRecipientIds
          : await this.recipients(
              tx,
              context.familyId,
              wallet,
              userId,
              context.role,
              dto.reminderRecipientIds,
            );
      const reminderOffsetMinutes =
        dto.reminderOffsetMinutes === undefined
          ? current.reminderOffsetMinutes
          : dto.reminderOffsetMinutes;
      const result = await tx.recurringPayment.updateMany({
        where: { id: current.id, version: expectedVersion ?? current.version, archivedAt: null },
        data: {
          title: dto.title?.trim(),
          note: dto.note?.trim(),
          amountMinor: dto.amountMinor ? this.amount(dto.amountMinor) : undefined,
          frequency: dto.frequency,
          interval: dto.interval,
          nextDueAt: dto.nextDueAt ? dueAt : undefined,
          categoryId: dto.categoryId,
          reminderOffsetMinutes,
          reminderRecipientIds: recipients,
          active: dto.active,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1)
        throw new ConflictException('Recurring payment was changed concurrently');
      if (dto.nextDueAt !== undefined || dto.reminderOffsetMinutes !== undefined) {
        await tx.recurringPaymentForecast.deleteMany({
          where: { recurringPaymentId: current.id, reminderSentAt: null },
        });
        await tx.recurringPaymentForecast.create({
          data: {
            recurringPaymentId: current.id,
            dueAt,
            reminderAt: this.reminderAt(dueAt, reminderOffsetMinutes),
          },
        });
      }
      const updated = await tx.recurringPayment.findUniqueOrThrow({ where: { id: current.id } });
      await this.audit.record(
        {
          actorId: userId,
          familyId: context.familyId,
          action: 'recurring_payment.updated',
          resourceType: 'recurring_payment',
          resourceId: current.id,
        },
        tx,
      );
      return this.serialize(updated);
    });
  }

  async archive(userId: string, id: string, expectedVersion?: number) {
    const context = await this.membership.requireMembership(userId);
    const payment = await this.findManageable(userId, id, context.familyId, context.role);
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.recurringPayment.updateMany({
        where: { id: payment.id, archivedAt: null, version: expectedVersion ?? payment.version },
        data: { active: false, archivedAt: new Date(), version: { increment: 1 } },
      });
      if (result.count !== 1)
        throw new ConflictException('Recurring payment was changed concurrently');
      await this.audit.record(
        {
          actorId: userId,
          familyId: context.familyId,
          action: 'recurring_payment.archived',
          resourceType: 'recurring_payment',
          resourceId: payment.id,
        },
        tx,
      );
    });
  }

  async restore(userId: string, id: string, expectedVersion?: number) {
    const context = await this.membership.requireMembership(userId);
    const payment = await this.prisma.recurringPayment.findFirst({
      where: { id, familyId: context.familyId, archivedAt: { not: null } },
      include: { wallet: true },
    });
    if (!payment || !this.canManage(payment.wallet, userId, context.role))
      throw new NotFoundException('Recurring payment not found');
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.recurringPayment.updateMany({
        where: {
          id: payment.id,
          archivedAt: { not: null },
          version: expectedVersion ?? payment.version,
          wallet: { archivedAt: null },
        },
        data: { active: true, archivedAt: null, version: { increment: 1 } },
      });
      if (result.count !== 1) throw new ConflictException('Recurring payment cannot be restored');
      const restored = await tx.recurringPayment.findUniqueOrThrow({ where: { id: payment.id } });
      await this.audit.record(
        {
          actorId: userId,
          familyId: context.familyId,
          action: 'recurring_payment.restored',
          resourceType: 'recurring_payment',
          resourceId: payment.id,
        },
        tx,
      );
      return this.serialize(restored);
    });
  }

  async generateDueForecasts(now = new Date()): Promise<number> {
    const payments = await this.prisma.recurringPayment.findMany({
      where: {
        active: true,
        archivedAt: null,
        nextDueAt: { lte: now },
        wallet: { archivedAt: null },
      },
      take: 100,
    });
    let generated = 0;
    for (const payment of payments) {
      const nextDueAt = this.nextDueAt(payment.nextDueAt, payment.frequency, payment.interval, now);
      const result = await this.prisma.$transaction(async (tx) => {
        const advanced = await tx.recurringPayment.updateMany({
          where: {
            id: payment.id,
            active: true,
            archivedAt: null,
            nextDueAt: payment.nextDueAt,
            version: payment.version,
          },
          data: { nextDueAt, version: { increment: 1 } },
        });
        if (advanced.count !== 1) return false;
        await tx.recurringPaymentForecast.create({
          data: {
            recurringPaymentId: payment.id,
            dueAt: nextDueAt,
            reminderAt: this.reminderAt(nextDueAt, payment.reminderOffsetMinutes),
          },
        });
        return true;
      });
      if (result) generated += 1;
    }
    return generated;
  }

  private async findVisible(userId: string, id: string) {
    const { familyId, role } = await this.membership.requireMembership(userId);
    const payment = await this.prisma.recurringPayment.findFirst({
      where: {
        id,
        familyId,
        archivedAt: null,
        wallet: { ...this.wallets.visibleTo(userId, role) },
      },
    });
    if (!payment) throw new NotFoundException('Recurring payment not found');
    return payment;
  }
  private async findManageable(
    userId: string,
    id: string,
    familyId: string,
    role: FamilyMemberRole,
  ) {
    const payment = await this.prisma.recurringPayment.findFirst({
      where: { id, familyId, archivedAt: null },
      include: { wallet: true },
    });
    if (!payment || !this.canManage(payment.wallet, userId, role))
      throw new NotFoundException('Recurring payment not found');
    return payment;
  }
  private canManage(
    wallet: { ownerId: string | null; type: WalletType },
    userId: string,
    role: FamilyMemberRole,
  ) {
    return (
      wallet.ownerId === userId ||
      (wallet.type === WalletType.FAMILY && role === FamilyMemberRole.PARTNER)
    );
  }
  private async validateCategory(
    tx: Prisma.TransactionClient,
    familyId: string,
    categoryId: string | undefined,
    type: RecurringPaymentType,
  ) {
    if (!categoryId) return;
    const category = await tx.financialCategory.findFirst({
      where: { id: categoryId, familyId, archivedAt: null },
    });
    if (!category || category.kind !== type)
      throw new NotFoundException('Financial category not found');
  }
  private async recipients(
    tx: Prisma.TransactionClient,
    familyId: string,
    wallet: { ownerId: string | null; type: WalletType; visibility: string },
    userId: string,
    role: FamilyMemberRole,
    ids: string[],
  ) {
    if (!ids.length) throw new BadRequestException('At least one reminder recipient is required');
    const members = await tx.familyMember.findMany({
      where: { familyId, userId: { in: ids } },
      select: { userId: true, role: true },
    });
    if (members.length !== ids.length)
      throw new BadRequestException('Reminder recipients must belong to the family');
    if (
      wallet.type === WalletType.PERSONAL &&
      members.some(
        (member) =>
          member.userId !== wallet.ownerId &&
          !(wallet.visibility === 'PARTNER' && member.role === FamilyMemberRole.PARTNER),
      )
    )
      throw new BadRequestException('A private wallet reminder cannot be shared');
    if (!this.canManage(wallet, userId, role)) throw new NotFoundException('Wallet not found');
    return ids;
  }
  private amount(value: string) {
    const amount = BigInt(value);
    if (amount > MAX_AMOUNT_MINOR) throw new BadRequestException('Amount is too large');
    return amount;
  }
  private futureDate(value: string) {
    const date = new Date(value);
    if (date <= new Date()) throw new BadRequestException('Next due date must be in the future');
    return date;
  }
  private reminderAt(dueAt: Date, offset?: number | null) {
    return new Date(dueAt.getTime() - (offset ?? 0) * 60_000);
  }
  private nextDueAt(current: Date, frequency: 'WEEKLY' | 'MONTHLY', interval: number, now: Date) {
    const next = new Date(current);
    do {
      if (frequency === 'WEEKLY') {
        next.setUTCDate(next.getUTCDate() + interval * 7);
      } else {
        next.setUTCMonth(next.getUTCMonth() + interval);
      }
    } while (next <= now);
    return next;
  }
  private serialize(payment: {
    id: string;
    walletId: string;
    categoryId: string | null;
    type: RecurringPaymentType;
    title: string;
    note: string | null;
    amountMinor: bigint;
    frequency: 'WEEKLY' | 'MONTHLY';
    interval: number;
    nextDueAt: Date;
    reminderOffsetMinutes: number | null;
    reminderRecipientIds: string[];
    active: boolean;
    version: number;
  }) {
    return { ...payment, amountMinor: payment.amountMinor.toString() };
  }
}
