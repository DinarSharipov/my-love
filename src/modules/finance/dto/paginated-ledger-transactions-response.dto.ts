import { ApiProperty } from '@nestjs/swagger';
import { PaginationResponseDto } from '../../../common/dto/pagination-response.dto';
import { LedgerTransactionResponseDto } from './ledger-transaction-response.dto';

export class PaginatedLedgerTransactionsResponseDto extends PaginationResponseDto {
  @ApiProperty({ type: [LedgerTransactionResponseDto] }) data: LedgerTransactionResponseDto[];
}
