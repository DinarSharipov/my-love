import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class FinancialSummaryQueryDto {
  @ApiPropertyOptional({
    example: '2026-08-01',
    description: 'First calendar day of the requested month; defaults to the current UTC month.',
  })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  periodStart?: string;
}

export class FinancialAmountByCurrencyResponseDto {
  @ApiProperty({ example: 'RUB' }) currency: string;
  @ApiProperty({ example: '125000', description: 'Absolute amount in minor currency units.' })
  amountMinor: string;
}

export class FinancialSummaryBudgetResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: '500000', description: 'Planned limit in the family default currency.' })
  limitMinor: string;
  @ApiProperty({ example: '125000', description: 'Actual expense in the family default currency.' })
  actualMinor: string;
  @ApiProperty({ example: '375000', description: 'Limit minus actual; may be negative.' })
  remainingMinor: string;
  @ApiProperty() version: number;
}

export class FinancialSummaryCategoryResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty({ enum: ['INCOME', 'EXPENSE'] }) kind: 'INCOME' | 'EXPENSE';
  @ApiProperty() archived: boolean;
  @ApiProperty({ type: [FinancialAmountByCurrencyResponseDto] })
  actual: FinancialAmountByCurrencyResponseDto[];
  @ApiPropertyOptional({ type: FinancialSummaryBudgetResponseDto, nullable: true })
  budget: FinancialSummaryBudgetResponseDto | null;
}

export class FinancialSummaryResponseDto {
  @ApiProperty({ example: '2026-08-01' }) periodStart: string;
  @ApiProperty({ example: 'RUB' }) defaultCurrency: string;
  @ApiProperty({ type: [FinancialSummaryCategoryResponseDto] })
  categories: FinancialSummaryCategoryResponseDto[];
}
