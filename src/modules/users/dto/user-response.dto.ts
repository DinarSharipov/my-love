import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender, User } from '@prisma/client';

export class UserResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'Иван' }) firstName: string;
  @ApiProperty({ example: 'Иванов' }) lastName: string;
  @ApiProperty({ example: 'ivan@example.com' }) email: string;
  @ApiProperty({ enum: Gender }) gender: Gender;
  @ApiPropertyOptional({ type: String, nullable: true }) description: string | null;
  @ApiProperty({ type: String, format: 'date', example: '1995-05-20' }) birthDate: Date;
  @ApiPropertyOptional({ type: String, nullable: true, example: '+79991234567' })
  phone: string | null;
  @ApiPropertyOptional({ type: String, format: 'uri', nullable: true })
  avatarUrl: string | null;
  @ApiProperty({ example: 'ru-RU' }) locale: string;
  @ApiProperty({ example: 'Europe/Moscow' }) timeZone: string;
  @ApiProperty({ minimum: 1 }) version: number;
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
      avatarUrl:
        user.avatarPreviewObjectKey && user.avatarPreviewToken
          ? `/api/v1/users/${user.id}/avatar?token=${encodeURIComponent(user.avatarPreviewToken)}`
          : null,
      locale: user.locale,
      timeZone: user.timeZone,
      version: user.version,
      createdAt: user.createdAt,
    };
  }
}
