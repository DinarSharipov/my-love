import { Module } from '@nestjs/common';
import { FamilyMembersModule } from '../family-members/family-members.module';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';
import { LedgerCommandsController } from './ledger-commands.controller';
import { LedgerCommandsService } from './ledger-commands.service';

@Module({
  imports: [FamilyMembersModule],
  controllers: [WalletsController, LedgerCommandsController],
  providers: [WalletsService, LedgerCommandsService],
  exports: [WalletsService],
})
export class FinanceModule {}
