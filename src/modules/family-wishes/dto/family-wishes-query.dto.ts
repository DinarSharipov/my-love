import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { FamilyWishApprovalStatus, FamilyWishImplementationStatus } from '@prisma/client';

export class FamilyWishesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: FamilyWishImplementationStatus })
  @IsOptional()
  @IsEnum(FamilyWishImplementationStatus)
  implementationStatus?: FamilyWishImplementationStatus;

  @ApiPropertyOptional({ enum: FamilyWishApprovalStatus })
  @IsOptional()
  @IsEnum(FamilyWishApprovalStatus)
  partnerApprovalStatus?: FamilyWishApprovalStatus;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  createdTo?: string;
}
