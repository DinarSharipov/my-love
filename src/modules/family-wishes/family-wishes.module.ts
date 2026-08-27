import { Module } from '@nestjs/common';
import { NotificationProducerModule } from '../../common/notifications/notification-producer.module';
import { FamilyMembersModule } from '../family-members/family-members.module';
import { FamilyWishesController } from './family-wishes.controller';
import { FamilyWishesService } from './family-wishes.service';

@Module({
  imports: [FamilyMembersModule, NotificationProducerModule],
  controllers: [FamilyWishesController],
  providers: [FamilyWishesService],
})
export class FamilyWishesModule {}
