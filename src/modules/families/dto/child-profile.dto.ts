import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';

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

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Family image media to use as a private child avatar preview',
  })
  @IsOptional()
  @IsUUID()
  avatarMediaId?: string | null;
}

export class UpdateChildProfileDto extends PartialType(CreateChildProfileDto) {}

export class ChildProfileResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) familyId: string;
  @ApiProperty() firstName: string;
  @ApiPropertyOptional() lastName: string | null;
  @ApiProperty() birthDate: Date;
  @ApiPropertyOptional() avatarUrl: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) avatarMediaId: string | null;
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
