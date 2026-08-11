import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender, User } from '@prisma/client';

export class UserResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'Иван' }) firstName: string;
  @ApiProperty({ example: 'Иванов' }) lastName: string;
  @ApiProperty({ example: 'ivan@example.com' }) email: string;
  @ApiProperty({ enum: Gender }) gender: Gender;
  @ApiPropertyOptional({ nullable: true }) description: string | null;
  @ApiProperty({ type: String, format: 'date', example: '1995-05-20' }) birthDate: Date;
  @ApiPropertyOptional({ nullable: true, example: '+79991234567' }) phone: string | null;
  @ApiProperty() createdAt: Date;

  static fromEntity(user: User): UserResponseDto {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      gender: user.gender,
      description: user.description,
      birthDate: user.birthDate,
      phone: user.phone,
      createdAt: user.createdAt,
    };
  }
}
