import { Injectable, Logger } from '@nestjs/common';
import { FamilyInvitationStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { NotificationProducerService } from '../notifications/notification-producer.service';
import { TaskRoutinesService } from '../../modules/tasks/task-routines.service';

export interface CleanupResult {
  sessions: number;
  passwordResetTokens: number;
  emailChangeTokens: number;
  accountDeletionTokens: number;
  telegramLinkTokens: number;
  familyInvitations: number;
  privateInvitations: number;
}

export interface RetentionResult {
  anonymizedUsers: number;
}
export interface ReminderResult {
  delivered: number;
}

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationProducerService,
    private readonly taskRoutines: TaskRoutinesService,
  ) {}

  async cleanupExpiredSecurityArtifacts(now = new Date()): Promise<CleanupResult> {
    const [
      sessions,
      passwordResetTokens,
      emailChangeTokens,
      accountDeletionTokens,
      telegramLinkTokens,
      familyInvitations,
      privateInvitations,
    ] = await this.prisma.$transaction([
      this.prisma.authSession.deleteMany({ where: { expiresAt: { lte: now } } }),
      this.prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lte: now } } }),
      this.prisma.emailChangeToken.deleteMany({ where: { expiresAt: { lte: now } } }),
      this.prisma.accountDeletionToken.deleteMany({ where: { expiresAt: { lte: now } } }),
      this.prisma.telegramLinkToken.deleteMany({ where: { expiresAt: { lte: now } } }),
      this.prisma.familyInvitation.updateMany({
        where: { status: FamilyInvitationStatus.PENDING, expiresAt: { lte: now } },
        data: { status: FamilyInvitationStatus.EXPIRED, respondedAt: now },
      }),
      this.prisma.privateFamilyInvitation.updateMany({
        where: { status: FamilyInvitationStatus.PENDING, expiresAt: { lte: now } },
        data: { status: FamilyInvitationStatus.EXPIRED, respondedAt: now },
      }),
    ]);

    const result = {
      sessions: sessions.count,
      passwordResetTokens: passwordResetTokens.count,
      emailChangeTokens: emailChangeTokens.count,
      accountDeletionTokens: accountDeletionTokens.count,
      telegramLinkTokens: telegramLinkTokens.count,
      familyInvitations: familyInvitations.count,
      privateInvitations: privateInvitations.count,
    } satisfies CleanupResult;
    if (Object.values(result).some((count) => count > 0)) {
      this.logger.log({ event: 'maintenance_cleanup_completed', ...result });
    }
    return result;
  }

  async anonymizeExpiredAccounts(now = new Date()): Promise<RetentionResult> {
    const users = await this.prisma.user.findMany({
      where: { isActive: false, retentionAnonymizedAt: null, deletionScheduledAt: { lte: now } },
      select: { id: true },
      take: 100,
    });
    let anonymizedUsers = 0;
    for (const user of users) {
      const result = await this.prisma.user.updateMany({
        where: { id: user.id, isActive: false, retentionAnonymizedAt: null },
        data: {
          firstName: 'Удалённый',
          lastName: 'Пользователь',
          email: `deleted+${user.id}@invalid.local`,
          description: null,
          phone: null,
          birthDate: new Date('1970-01-01T00:00:00.000Z'),
          retentionAnonymizedAt: now,
        },
      });
      anonymizedUsers += result.count;
    }
    if (anonymizedUsers) this.logger.log({ event: 'account_retention_completed', anonymizedUsers });
    return { anonymizedUsers };
  }

  async deliverDueReminders(now = new Date()): Promise<ReminderResult> {
    const reminders = await this.prisma.taskReminder.findMany({
      where: { sentAt: null, remindAt: { lte: now } },
      include: {
        task: true,
      },
      take: 100,
    });
    let delivered = 0;
    for (const reminder of reminders) {
      const result = await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.taskReminder.updateMany({
          where: { id: reminder.id, sentAt: null },
          data: { sentAt: now },
        });
        if (claimed.count !== 1) return false;
        await this.notifications.notifyUserInTransaction(
          tx,
          {
            userId: reminder.userId,
            familyId: reminder.task.familyId,
            type: 'TASK_REMINDER',
            title: reminder.task.title,
            body: 'Напоминание о задаче',
          },
          now,
        );
        return true;
      });
      if (result) delivered += 1;
    }
    return { delivered };
  }

  generateDueTaskRoutines(now = new Date()): Promise<{ generated: number }> {
    return this.taskRoutines.generateDue(now);
  }
}
