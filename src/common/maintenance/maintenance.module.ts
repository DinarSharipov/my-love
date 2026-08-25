import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceWorker } from './maintenance.worker';
import { OutboxModule } from '../outbox/outbox.module';
import { NotificationProducerModule } from '../notifications/notification-producer.module';
import { TasksModule } from '../../modules/tasks/tasks.module';
import { FinanceModule } from '../../modules/finance/finance.module';
import { MediaModule } from '../../modules/media/media.module';

@Module({
  imports: [
    DatabaseModule,
    OutboxModule,
    NotificationProducerModule,
    TasksModule,
    FinanceModule,
    MediaModule,
  ],
  providers: [MaintenanceService, MaintenanceWorker],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
