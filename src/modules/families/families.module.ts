import { Module } from '@nestjs/common';
import { FamiliesController } from './families.controller';
import { FamiliesService } from './families.service';
import { FamilyInvitationsController } from './family-invitations.controller';
import { FamilyInvitationsService } from './family-invitations.service';

@Module({
  controllers: [FamiliesController, FamilyInvitationsController],
  providers: [FamiliesService, FamilyInvitationsService],
})
export class FamiliesModule {}
