import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FamilyInvitationStatus, PrivateFamilyInvitation } from '@prisma/client';

export class PrivateFamilyInvitationResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'partner@example.com' }) recipientEmail: string;
  @ApiProperty({ enum: FamilyInvitationStatus }) status: FamilyInvitationStatus;
  @ApiProperty() expiresAt: Date;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  respondedAt: Date | null;
  @ApiProperty() createdAt: Date;

  static fromEntity(invitation: PrivateFamilyInvitation): PrivateFamilyInvitationResponseDto {
    return {
      id: invitation.id,
      recipientEmail: invitation.recipientEmail,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      respondedAt: invitation.respondedAt,
      createdAt: invitation.createdAt,
    };
  }
}

export class CreatedPrivateFamilyInvitationResponseDto extends PrivateFamilyInvitationResponseDto {
  @ApiProperty({
    description: 'Shown only in the create response. Share it directly with the intended partner.',
    example: 'http://localhost:5173/join-family#token=one-time-token',
  })
  inviteUrl: string;

  static fromCreatedEntity(
    invitation: PrivateFamilyInvitation,
    inviteUrl: string,
  ): CreatedPrivateFamilyInvitationResponseDto {
    return { ...PrivateFamilyInvitationResponseDto.fromEntity(invitation), inviteUrl };
  }
}
