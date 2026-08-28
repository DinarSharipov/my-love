import { Module } from '@nestjs/common';
import { FamilyMembersModule } from '../family-members/family-members.module';
import { IntimacyController } from './intimacy.controller';
import { IntimacyService } from './intimacy.service';

@Module({
  imports: [FamilyMembersModule],
  controllers: [IntimacyController],
  providers: [IntimacyService],
})
export class IntimacyModule {}
