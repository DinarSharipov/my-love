import { Global, Module } from '@nestjs/common';
import { NotificationProducerService } from './notification-producer.service';
import { OutboxModule } from '../outbox/outbox.module';

@Global()
@Module({
  imports: [OutboxModule],
  providers: [NotificationProducerService],
  exports: [NotificationProducerService],
})
export class NotificationProducerModule {}
