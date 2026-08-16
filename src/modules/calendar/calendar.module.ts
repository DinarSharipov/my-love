import { Module } from '@nestjs/common';
import { FamilyMembersModule } from '../family-members/family-members.module';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';

@Module({
  imports: [FamilyMembersModule],
  controllers: [CalendarController],
  providers: [CalendarService],
})
export class CalendarModule {}
