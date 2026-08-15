import { Module } from '@nestjs/common';
import { FamilyMembershipService } from './family-membership.service';

@Module({
  providers: [FamilyMembershipService],
  exports: [FamilyMembershipService],
})
export class FamilyMembersModule {}
