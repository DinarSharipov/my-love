import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CreateWellbeingRitualDto {
  @ApiProperty({ example: 'Sunday walk' })
  @IsString()
  @Length(1, 200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ example: 'WEEKLY' })
  @IsString()
  @Length(1, 50)
  cadence!: string;

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  nextAt!: string;
}

export class UpdateWellbeingRitualDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 50)
  cadence?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  nextAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class WellbeingRitualResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() familyId!: string;
  @ApiProperty() createdById!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional() description!: string | null;
  @ApiProperty() cadence!: string;
  @ApiProperty({ format: 'date-time' }) nextAt!: Date;
  @ApiProperty() isActive!: boolean;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt!: Date;
}
