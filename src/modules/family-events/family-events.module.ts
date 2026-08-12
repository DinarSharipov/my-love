import { Module } from '@nestjs/common';
import { FamilyEventsController } from './family-events.controller';
import { FamilyEventsService } from './family-events.service';

@Module({
  controllers: [FamilyEventsController],
  providers: [FamilyEventsService],
})
export class FamilyEventsModule {}
