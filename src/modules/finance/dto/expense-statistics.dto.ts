import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class ExpenseStatisticsQueryDto {
  @ApiPropertyOptional({ example: '2026-01-01', description: 'Inclusive UTC calendar date.' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-08-17', description: 'Inclusive UTC calendar date.' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateTo?: string;
}

export class ExpenseStatisticsAmountDto {
  @ApiProperty({ example: 'RUB' }) currency: string;
  @ApiProperty({ example: '125000', description: 'Minor units.' }) amountMinor: string;
}

export class ExpenseStatisticsCategoryDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) categoryId: string | null;
  @ApiProperty({ example: 'Продукты' }) name: string;
  @ApiProperty({ type: [ExpenseStatisticsAmountDto] }) totals: ExpenseStatisticsAmountDto[];
}

export class ExpenseStatisticsMemberDto {
  @ApiProperty({ format: 'uuid' }) userId: string;
  @ApiProperty({ example: 'Иван' }) firstName: string;
  @ApiProperty({ example: 'Иванов' }) lastName: string;
  @ApiProperty({ type: [ExpenseStatisticsAmountDto] }) totals: ExpenseStatisticsAmountDto[];
  @ApiProperty({ type: [ExpenseStatisticsCategoryDto] }) categories: ExpenseStatisticsCategoryDto[];
}

export class ExpenseStatisticsResponseDto {
  @ApiPropertyOptional({ example: '2026-01-01', nullable: true }) dateFrom: string | null;
  @ApiPropertyOptional({ example: '2026-08-17', nullable: true }) dateTo: string | null;
  @ApiProperty({ type: [ExpenseStatisticsAmountDto] }) totals: ExpenseStatisticsAmountDto[];
  @ApiProperty({ type: [ExpenseStatisticsMemberDto] }) members: ExpenseStatisticsMemberDto[];
}
