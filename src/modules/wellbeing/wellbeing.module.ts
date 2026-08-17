import { Module } from '@nestjs/common';
import { FamilyMembersModule } from '../family-members/family-members.module';
import { NotificationProducerModule } from '../../common/notifications/notification-producer.module';
import { WellbeingController } from './wellbeing.controller';
import { WellbeingService } from './wellbeing.service';

@Module({
  imports: [FamilyMembersModule, NotificationProducerModule],
  controllers: [WellbeingController],
  providers: [WellbeingService],
})
export class WellbeingModule {}
