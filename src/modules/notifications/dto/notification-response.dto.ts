import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Notification } from '@prisma/client';
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

  static fromEntity(notification: Notification): NotificationResponseDto {
    return {
      id: notification.id,
      userId: notification.userId,
      familyId: notification.familyId,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    };
  }
}

export class PaginatedNotificationsResponseDto extends PaginationResponseDto {
  @ApiProperty({ type: [NotificationResponseDto] }) data: NotificationResponseDto[];
}
