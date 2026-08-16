import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MaintenanceService } from './maintenance.service';

@Injectable()
export class MaintenanceWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MaintenanceWorker.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly maintenance: MaintenanceService,
  ) {}

  onModuleInit(): void {
    if (!this.config.get<boolean>('CLEANUP_WORKER_ENABLED', true)) return;
    const interval = this.config.get<number>('CLEANUP_POLL_INTERVAL_MS', 3_600_000);
    this.timer = setInterval(() => void this.tick(), interval);
    void this.tick();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.maintenance.cleanupExpiredSecurityArtifacts();
      await this.maintenance.generateDueTaskRoutines();
      await this.maintenance.deliverDueReminders();
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
}
