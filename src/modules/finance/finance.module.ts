import { Module } from '@nestjs/common';
import { FamilyMembersModule } from '../family-members/family-members.module';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';

@Module({
  imports: [FamilyMembersModule],
  controllers: [WalletsController],
  providers: [WalletsService],
  exports: [WalletsService],
})
export class FinanceModule {}
