import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FamilyEvent, Prisma, User } from '@prisma/client';
import { UserResponseDto } from '../../users/dto/user-response.dto';
import { FamilyEventStatus, resolveFamilyEventStatus } from '../family-event-status';

export const familyEventInclude = {
  proposedBy: true,
  respondedBy: true,
  mediaAttachments: { include: { media: true }, orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.FamilyEventInclude;

export type FamilyEventEntity = FamilyEvent & {
  proposedBy: User;
  respondedBy: User | null;
  mediaAttachments: { media: { id: string } }[];
};

export class FamilyEventResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) familyId: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) childId: string | null;
  @ApiProperty() name: string;
  @ApiPropertyOptional({ type: String, nullable: true }) description: string | null;
  @ApiProperty({ format: 'date-time' }) scheduledAt: Date;
  @ApiProperty() location: string;
  @ApiPropertyOptional({ minimum: 1, nullable: true }) reminderOffsetMinutes: number | null;
  @ApiProperty({ type: [String], format: 'uuid' }) reminderRecipientIds: string[];
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  repeatReminderAt: Date | null;
  @ApiProperty({ enum: FamilyEventStatus }) status: FamilyEventStatus;
  @ApiProperty({ type: UserResponseDto }) proposedBy: UserResponseDto;
  @ApiPropertyOptional({ type: UserResponseDto, nullable: true })
  respondedBy: UserResponseDto | null;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  respondedAt: Date | null;
  @ApiProperty({ minimum: 1 }) version: number;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiProperty({ type: [String], format: 'uuid' }) mediaIds: string[];

  static fromEntity(
    event: FamilyEventEntity,
    timeZone: string,
    now = new Date(),
  ): FamilyEventResponseDto {
    return {
      id: event.id,
      familyId: event.familyId,
      childId: event.childId,
      name: event.name,
      description: event.description,
      scheduledAt: event.scheduledAt,
      location: event.location,
      reminderOffsetMinutes: event.reminderOffsetMinutes,
      reminderRecipientIds: event.reminderRecipientIds,
      repeatReminderAt: event.repeatReminderAt,
      status: resolveFamilyEventStatus(event.status, event.scheduledAt, now, timeZone),
      proposedBy: UserResponseDto.fromEntity(event.proposedBy),
      respondedBy: event.respondedBy ? UserResponseDto.fromEntity(event.respondedBy) : null,
      respondedAt: event.respondedAt,
      version: event.version,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
      mediaIds: (event.mediaAttachments ?? []).map(({ media }) => media.id),
    };
  }
}
