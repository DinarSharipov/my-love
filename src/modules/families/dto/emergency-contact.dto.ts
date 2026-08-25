import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CreateEmergencyContactDto {
  @ApiProperty() @IsString() @Length(1, 160) name: string;
  @ApiProperty() @IsString() @Length(1, 100) relationship: string;
  @ApiProperty() @IsString() @Length(3, 32) phone: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() @MaxLength(320) email?: string;
}
export class UpdateEmergencyContactDto extends PartialType(CreateEmergencyContactDto) {}
export class EmergencyContactResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() familyId: string;
  @ApiProperty() name: string;
  @ApiProperty() relationship: string;
  @ApiProperty() phone: string;
  @ApiPropertyOptional({ nullable: true }) email: string | null;
  @ApiProperty() archived: boolean;
  @ApiPropertyOptional({ nullable: true }) archivedAt: Date | null;
  @ApiProperty() version: number;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}
