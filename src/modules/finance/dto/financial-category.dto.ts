import { FinancialCategoryKind } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateFinancialCategoryDto {
  @ApiProperty({ maxLength: 120 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @ApiProperty({ enum: FinancialCategoryKind })
  @IsEnum(FinancialCategoryKind)
  kind: FinancialCategoryKind;
}

export class UpdateFinancialCategoryDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;
}

export class FinancialCategoryResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) familyId: string;
  @ApiProperty({ format: 'uuid' }) createdById: string;
  @ApiProperty({ enum: FinancialCategoryKind }) kind: FinancialCategoryKind;
  @ApiProperty() name: string;
  @ApiProperty() version: number;
  @ApiProperty({ format: 'date-time' }) createdAt: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt: Date;
}
