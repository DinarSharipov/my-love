import { Module } from '@nestjs/common';
import { OutboxModule } from '../../common/outbox/outbox.module';
import { HealthController } from './health.controller';

@Module({ imports: [OutboxModule], controllers: [HealthController] })
export class HealthModule {}
