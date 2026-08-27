import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  FamilyWish,
  FamilyWishApprovalStatus,
  FamilyWishImplementationStatus,
  FamilyWishRealizationConfirmationStatus,
} from '@prisma/client';

export class FamilyWishUserDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
}

export type FamilyWishEntity = FamilyWish & {
  createdBy: FamilyWishUserDto;
  partner: FamilyWishUserDto;
  realizedBy: FamilyWishUserDto | null;
};

export class FamilyWishResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) familyId!: string;
  @ApiProperty({ type: FamilyWishUserDto }) createdBy!: FamilyWishUserDto;
  @ApiProperty({ type: FamilyWishUserDto }) partner!: FamilyWishUserDto;
  @ApiProperty() title!: string;
  @ApiPropertyOptional({ nullable: true }) description!: string | null;
  @ApiProperty({ enum: FamilyWishImplementationStatus })
  implementationStatus!: FamilyWishImplementationStatus;
  @ApiProperty({ enum: FamilyWishApprovalStatus }) partnerApprovalStatus!: FamilyWishApprovalStatus;
  @ApiProperty({ enum: FamilyWishRealizationConfirmationStatus })
  realizationConfirmationStatus!: FamilyWishRealizationConfirmationStatus;
  @ApiPropertyOptional({ type: FamilyWishUserDto, nullable: true })
  realizedBy!: FamilyWishUserDto | null;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  realizedAt!: Date | null;
  @ApiProperty({ minimum: 1 }) version!: number;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: Date;

  static fromEntity(entity: FamilyWishEntity): FamilyWishResponseDto {
    return { ...entity };
  }
}

export class PaginatedFamilyWishesResponseDto {
  @ApiProperty({ type: [FamilyWishResponseDto] }) data!: FamilyWishResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() totalPages!: number;
}
