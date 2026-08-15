import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceWorker } from './maintenance.worker';

@Module({
  imports: [DatabaseModule],
  providers: [MaintenanceService, MaintenanceWorker],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
