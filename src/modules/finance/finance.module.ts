import { Module } from '@nestjs/common';
import { FamilyMembersModule } from '../family-members/family-members.module';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';
import { LedgerCommandsController } from './ledger-commands.controller';
import { LedgerCommandsService } from './ledger-commands.service';
import { LedgerHistoryService } from './ledger-history.service';
import { FinancialCategoriesController } from './financial-categories.controller';
import { FinancialCategoriesService } from './financial-categories.service';
import { BudgetsController } from './budgets.controller';
import { BudgetsService } from './budgets.service';
import { RecurringPaymentsController } from './recurring-payments.controller';
import { RecurringPaymentsService } from './recurring-payments.service';
import { FinancialSummaryController } from './financial-summary.controller';
import { FinancialSummaryService } from './financial-summary.service';

@Module({
  imports: [FamilyMembersModule],
  controllers: [
    WalletsController,
    LedgerCommandsController,
    FinancialCategoriesController,
    BudgetsController,
    RecurringPaymentsController,
    FinancialSummaryController,
  ],
  providers: [
    WalletsService,
    LedgerCommandsService,
    LedgerHistoryService,
    FinancialCategoriesService,
    BudgetsService,
    RecurringPaymentsService,
    FinancialSummaryService,
  ],
  exports: [WalletsService, RecurringPaymentsService],
})
export class FinanceModule {}
