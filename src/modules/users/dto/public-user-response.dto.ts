import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender, User } from '@prisma/client';

type PublicUserEntity = User & { familyMember: { id: string } | null };

export class PublicUserResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'Иван' }) firstName: string;
  @ApiProperty({ example: 'Иванов' }) lastName: string;
  @ApiProperty({ enum: Gender }) gender: Gender;
  @ApiPropertyOptional({ type: String, nullable: true }) description: string | null;
  @ApiProperty({ example: 'iv***@example.com' }) email: string;
  @ApiProperty({ description: 'Whether the user already belongs to a family' }) hasFamily: boolean;

  static fromEntity(user: PublicUserEntity): PublicUserResponseDto {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      gender: user.gender,
      description: user.description,
      email: this.maskEmail(user.email),
      hasFamily: user.familyMember !== null,
    };
  }

  private static maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    const visible = local.slice(0, Math.min(2, local.length));
    return `${visible}***@${domain}`;
  }
}
