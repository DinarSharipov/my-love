import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class FinancialAnalyticsQueryDto {
  @ApiPropertyOptional({ example: '2026-08-01', description: 'First day of the first UTC month.' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  periodStart?: string;

  @ApiPropertyOptional({ example: 6, minimum: 1, maximum: 12, default: 6 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  months?: number;

  @ApiPropertyOptional({ example: 30, minimum: 1, maximum: 365, default: 30 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  forecastDays?: number;
}

export class FinancialCashFlowCurrencyResponseDto {
  @ApiProperty({ example: 'RUB' }) currency: string;
  @ApiProperty({ example: '150000', description: 'Minor units.' }) incomeMinor: string;
  @ApiProperty({ example: '90000', description: 'Minor units.' }) expenseMinor: string;
  @ApiProperty({ example: '60000', description: 'Income minus expense in minor units.' })
  netMinor: string;
}

export class FinancialCashFlowMonthResponseDto {
  @ApiProperty({ example: '2026-08-01' }) periodStart: string;
  @ApiProperty({ type: [FinancialCashFlowCurrencyResponseDto] })
  actual: FinancialCashFlowCurrencyResponseDto[];
  @ApiProperty({ type: [FinancialCashFlowCurrencyResponseDto] })
  mandatory: FinancialCashFlowCurrencyResponseDto[];
}

export class FinancialBalanceForecastResponseDto {
  @ApiProperty({ example: 'RUB' }) currency: string;
  @ApiProperty({ example: '500000', description: 'Visible balance at the forecast start.' })
  currentBalanceMinor: string;
  @ApiProperty({ example: '150000' }) plannedIncomeMinor: string;
  @ApiProperty({ example: '90000' }) plannedExpenseMinor: string;
  @ApiProperty({ example: '560000' }) projectedBalanceMinor: string;
}

export class FinancialAnalyticsResponseDto {
  @ApiProperty({ example: '2026-08-01' }) periodStart: string;
  @ApiProperty({ example: 6 }) months: number;
  @ApiProperty({ type: [FinancialCashFlowMonthResponseDto] })
  cashFlow: FinancialCashFlowMonthResponseDto[];
  @ApiProperty({ example: '2026-08-17T12:00:00.000Z' }) forecastAsOf: Date;
  @ApiProperty({ example: '2026-09-16T12:00:00.000Z' }) forecastThrough: Date;
  @ApiProperty({ type: [FinancialBalanceForecastResponseDto] })
  balanceForecast: FinancialBalanceForecastResponseDto[];
}
