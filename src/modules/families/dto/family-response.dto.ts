import { ApiProperty } from '@nestjs/swagger';
import { Family, FamilyMember, User } from '@prisma/client';
import { UserResponseDto } from '../../users/dto/user-response.dto';

type FamilyEntity = Family & { members: Array<FamilyMember & { user: User }> };

class FamilyMemberResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() joinedAt: Date;
  @ApiProperty({ type: UserResponseDto }) user: UserResponseDto;
}

export class FamilyResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty({ type: [FamilyMemberResponseDto] }) members: FamilyMemberResponseDto[];

  static fromEntity(family: FamilyEntity): FamilyResponseDto {
    return {
      id: family.id,
      createdAt: family.createdAt,
      members: family.members.map((member) => ({
        id: member.id,
        joinedAt: member.joinedAt,
        user: UserResponseDto.fromEntity(member.user),
      })),
    };
  }
}
