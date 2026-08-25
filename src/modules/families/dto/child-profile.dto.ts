import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUrl, Length, MaxLength } from 'class-validator';

export class CreateChildProfileDto {
  @ApiProperty({ minLength: 1, maxLength: 100 })
  @IsString()
  @Length(1, 100)
  firstName: string;
  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;
  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  birthDate: string;
  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(1000)
  avatarUrl?: string;
}

export class UpdateChildProfileDto extends PartialType(CreateChildProfileDto) {}

export class ChildProfileResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) familyId: string;
  @ApiProperty() firstName: string;
  @ApiPropertyOptional() lastName: string | null;
  @ApiProperty() birthDate: Date;
  @ApiPropertyOptional() avatarUrl: string | null;
  @ApiProperty() archived: boolean;
  @ApiPropertyOptional({ nullable: true }) archivedAt: Date | null;
  @ApiProperty() version: number;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}

export class ChildProfileExportDto {
  @ApiProperty({ type: ChildProfileResponseDto })
  profile!: ChildProfileResponseDto;

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  tasks!: unknown[];

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  events!: unknown[];
}
