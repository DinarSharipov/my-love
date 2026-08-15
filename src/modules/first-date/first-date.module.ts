import { Module } from '@nestjs/common';
import { FamilyMembersModule } from '../family-members/family-members.module';
import { FirstDateController } from './first-date.controller';
import { FirstDateService } from './first-date.service';

@Module({
  imports: [FamilyMembersModule],
  controllers: [FirstDateController],
  providers: [FirstDateService],
})
export class FirstDateModule {}
