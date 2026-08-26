import { Module } from '@nestjs/common';
import { FamilyMembersModule } from '../family-members/family-members.module';
import { MediaModule } from '../media/media.module';
import { MealsController } from './meals.controller';
import { MealsService } from './meals.service';
@Module({
  imports: [FamilyMembersModule, MediaModule],
  controllers: [MealsController],
  providers: [MealsService],
})
export class MealsModule {}
