import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateWellbeingCheckInDto {
  @ApiProperty({ minimum: 1, maximum: 5 }) @IsInt() @Min(1) @Max(5) mood: number;
  @ApiProperty({ minimum: 1, maximum: 5 }) @IsInt() @Min(1) @Max(5) energy: number;
  @ApiProperty({ minimum: 1, maximum: 5 }) @IsInt() @Min(1) @Max(5) stress: number;
  @ApiPropertyOptional({ maxLength: 5000 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(5000)
  note?: string;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() supportRequest?: boolean;
}

export class WellbeingCheckInResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) ownerId: string;
  @ApiProperty({ minimum: 1, maximum: 5 }) mood: number;
  @ApiProperty({ minimum: 1, maximum: 5 }) energy: number;
  @ApiProperty({ minimum: 1, maximum: 5 }) stress: number;
  @ApiPropertyOptional({ nullable: true }) note: string | null;
  @ApiProperty() supportRequest: boolean;
  @ApiProperty({ format: 'date-time' }) createdAt: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt: Date;

  static fromEntity(entity: WellbeingCheckInResponseDto): WellbeingCheckInResponseDto {
    return entity;
  }
}
