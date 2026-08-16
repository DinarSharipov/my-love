import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceWorker } from './maintenance.worker';
import { OutboxModule } from '../outbox/outbox.module';

@Module({
  imports: [DatabaseModule, OutboxModule],
  providers: [MaintenanceService, MaintenanceWorker],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
