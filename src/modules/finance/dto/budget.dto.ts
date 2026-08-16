import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, Matches } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateBudgetDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  categoryId: string;

  @ApiProperty({ example: '2026-08-01', description: 'First calendar day of the budget month.' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  periodStart: string;

  @ApiProperty({ example: '500000', description: 'Positive limit in minor currency units.' })
  @IsString()
  @Matches(/^[1-9]\d{0,18}$/)
  limitMinor: string;
}

export class UpdateBudgetDto {
  @ApiProperty({ example: '500000', description: 'Positive limit in minor currency units.' })
  @IsString()
  @Matches(/^[1-9]\d{0,18}$/)
  limitMinor: string;
}

export class BudgetQueryDto {
  @ApiPropertyOptional({ example: '2026-08-01' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  periodStart?: string;
}

export class BudgetResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) familyId: string;
  @ApiProperty({ format: 'uuid' }) categoryId: string;
  @ApiProperty({ format: 'uuid' }) createdById: string;
  @ApiProperty({ example: '2026-08-01' }) periodStart: string;
  @ApiProperty({ example: '500000' }) limitMinor: string;
  @ApiProperty() version: number;
  @ApiProperty({ format: 'date-time' }) createdAt: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt: Date;
}
