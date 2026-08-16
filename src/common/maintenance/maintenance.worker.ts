import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MaintenanceService } from './maintenance.service';

@Injectable()
export class MaintenanceWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MaintenanceWorker.name);
  private timer?: NodeJS.Timeout;
  private reminderTimer?: NodeJS.Timeout;
  private running = false;
  private remindersRunning = false;

  constructor(
    private readonly config: ConfigService,
    private readonly maintenance: MaintenanceService,
  ) {}

  onModuleInit(): void {
    if (!this.config.get<boolean>('CLEANUP_WORKER_ENABLED', true)) return;
    const interval = this.config.get<number>('CLEANUP_POLL_INTERVAL_MS', 3_600_000);
    const reminderInterval = this.config.get<number>('REMINDER_POLL_INTERVAL_MS', 60_000);
    this.timer = setInterval(() => void this.tick(), interval);
    this.reminderTimer = setInterval(() => void this.deliverReminders(), reminderInterval);
    void this.tick();
    void this.deliverReminders();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.reminderTimer) clearInterval(this.reminderTimer);
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.maintenance.cleanupExpiredSecurityArtifacts();
      await this.maintenance.generateDueTaskRoutines();
      await this.maintenance.generateDueRecurringPaymentForecasts();
      if (this.config.get<boolean>('RETENTION_WORKER_ENABLED', false)) {
        await this.maintenance.anonymizeExpiredAccounts();
      }
    } catch (error) {
      this.logger.error({
        event: 'maintenance_worker_error',
        error: error instanceof Error ? error.message : 'unknown',
      });
    } finally {
      this.running = false;
    }
  }

  private async deliverReminders(): Promise<void> {
    if (this.remindersRunning) return;
    this.remindersRunning = true;
    try {
      await this.maintenance.deliverDueReminders();
    } catch (error) {
      this.logger.error({
        event: 'maintenance_reminders_error',
        error: error instanceof Error ? error.message : 'unknown',
      });
    } finally {
      this.remindersRunning = false;
    }
  }
}
