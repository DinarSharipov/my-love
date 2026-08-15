import { ApiProperty } from '@nestjs/swagger';
import { Family, FamilyMember, FamilyMemberRole, FamilyStatus, User } from '@prisma/client';
import { UserResponseDto } from '../../users/dto/user-response.dto';

type FamilyEntity = Family & { members: Array<FamilyMember & { user: User }> };

class FamilyMemberResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ enum: FamilyMemberRole }) role: FamilyMemberRole;
  @ApiProperty() joinedAt: Date;
  @ApiProperty({ type: UserResponseDto }) user: UserResponseDto;
}

export class FamilyResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ enum: FamilyStatus }) status: FamilyStatus;
  @ApiProperty() timeZone: string;
  @ApiProperty() locale: string;
  @ApiProperty({ minLength: 3, maxLength: 3 }) defaultCurrency: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty({ type: [FamilyMemberResponseDto] }) members: FamilyMemberResponseDto[];

  static fromEntity(family: FamilyEntity): FamilyResponseDto {
    return {
      id: family.id,
      status: family.status,
      timeZone: family.timeZone,
      locale: family.locale,
      defaultCurrency: family.defaultCurrency,
      createdAt: family.createdAt,
      members: family.members.map((member) => ({
        id: member.id,
        role: member.role,
        joinedAt: member.joinedAt,
        user: UserResponseDto.fromEntity(member.user),
      })),
    };
  }
}
