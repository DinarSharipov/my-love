import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FamilyDissolutionStatus } from '@prisma/client';
export class DissolutionResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: FamilyDissolutionStatus }) status: FamilyDissolutionStatus;
  @ApiProperty() familyId: string;
  @ApiProperty() requestedById: string;
  @ApiPropertyOptional({ nullable: true }) confirmedById: string | null;
  @ApiProperty() requestedAt: Date;
  @ApiPropertyOptional({ nullable: true }) confirmedAt: Date | null;
}
