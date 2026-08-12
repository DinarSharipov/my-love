import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FamilyInvitation, FamilyInvitationStatus, User } from '@prisma/client';
import { PublicUserResponseDto } from '../../users/dto/public-user-response.dto';

type InvitationEntity = FamilyInvitation & {
  sender: User & { familyMember: { id: string } | null };
  recipient: User & { familyMember: { id: string } | null };
};

export class FamilyInvitationResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ enum: FamilyInvitationStatus }) status: FamilyInvitationStatus;
  @ApiProperty({ type: PublicUserResponseDto }) sender: PublicUserResponseDto;
  @ApiProperty({ type: PublicUserResponseDto }) recipient: PublicUserResponseDto;
  @ApiProperty() expiresAt: Date;
  @ApiPropertyOptional({ nullable: true }) respondedAt: Date | null;
  @ApiProperty() createdAt: Date;

  static fromEntity(invitation: InvitationEntity): FamilyInvitationResponseDto {
    return {
      id: invitation.id,
      status: invitation.status,
      sender: PublicUserResponseDto.fromEntity(invitation.sender),
      recipient: PublicUserResponseDto.fromEntity(invitation.recipient),
      expiresAt: invitation.expiresAt,
      respondedAt: invitation.respondedAt,
      createdAt: invitation.createdAt,
    };
  }
}
