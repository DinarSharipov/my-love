import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuditEventResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) actorId: string | null;
  @ApiProperty({ format: 'uuid' }) familyId: string;
  @ApiProperty() action: string;
  @ApiProperty() resourceType: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) resourceId: string | null;
  @ApiPropertyOptional({ nullable: true }) metadata: unknown;
  @ApiProperty() createdAt: Date;
}
