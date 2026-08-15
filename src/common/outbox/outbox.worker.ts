import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OutboxService } from './outbox.service';

@Injectable()
export class OutboxWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxWorker.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly outbox: OutboxService,
  ) {}

  onModuleInit(): void {
    if (!this.config.get<boolean>('OUTBOX_WORKER_ENABLED', true)) return;
    const interval = this.config.get<number>('OUTBOX_POLL_INTERVAL_MS', 5_000);
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
      await this.outbox.processAvailable();
    } catch (error) {
      this.logger.error({
        event: 'outbox_worker_error',
        error: error instanceof Error ? error.message : 'unknown',
      });
    } finally {
      this.running = false;
    }
  }
}
