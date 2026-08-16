import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationResponseDto } from '../../../common/dto/pagination-response.dto';

export class NotificationResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) userId: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) familyId: string | null;
  @ApiProperty() type: string;
  @ApiProperty() title: string;
  @ApiPropertyOptional({ nullable: true }) body: string | null;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true }) readAt: Date | null;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt: Date;
}

export class PaginatedNotificationsResponseDto extends PaginationResponseDto {
  @ApiProperty({ type: [NotificationResponseDto] }) data: NotificationResponseDto[];
}
