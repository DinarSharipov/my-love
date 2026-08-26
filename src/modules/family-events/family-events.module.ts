import { Module } from '@nestjs/common';
import { NotificationProducerModule } from '../../common/notifications/notification-producer.module';
import { FamilyMembersModule } from '../family-members/family-members.module';
import { FamilyEventsController } from './family-events.controller';
import { FamilyEventsService } from './family-events.service';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [FamilyMembersModule, NotificationProducerModule, MediaModule],
  controllers: [FamilyEventsController],
  providers: [FamilyEventsService],
})
export class FamilyEventsModule {}
