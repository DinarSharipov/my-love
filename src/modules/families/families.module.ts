import { Module } from '@nestjs/common';
import { NotificationProducerModule } from '../../common/notifications/notification-producer.module';
import { FamilyMembersModule } from '../family-members/family-members.module';
import { FamiliesController } from './families.controller';
import { FamiliesService } from './families.service';
import { FamilyInvitationsController } from './family-invitations.controller';
import { FamilyInvitationsService } from './family-invitations.service';
import { ChildProfilesController } from './child-profiles.controller';
import { ChildProfilesService } from './child-profiles.service';

@Module({
  imports: [FamilyMembersModule, NotificationProducerModule],
  controllers: [FamiliesController, FamilyInvitationsController, ChildProfilesController],
  providers: [FamiliesService, FamilyInvitationsService, ChildProfilesService],
})
export class FamiliesModule {}
