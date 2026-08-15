import { Module } from '@nestjs/common';
import { FamilyMembersModule } from '../family-members/family-members.module';
import { FamilyEventsController } from './family-events.controller';
import { FamilyEventsService } from './family-events.service';

@Module({
  imports: [FamilyMembersModule],
  controllers: [FamilyEventsController],
  providers: [FamilyEventsService],
})
export class FamilyEventsModule {}
