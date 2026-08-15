import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { FamilyMembersModule } from '../family-members/family-members.module';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';
import { NotificationPreferencesService } from './preferences.service';
@Module({
  imports: [FamilyMembersModule],
  controllers: [NotificationsController, RemindersController],
  providers: [NotificationsService, RemindersService, NotificationPreferencesService],
})
export class NotificationsModule {}
