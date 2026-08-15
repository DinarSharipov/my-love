import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FirstDate, Prisma, User } from '@prisma/client';
import { UserResponseDto } from '../../users/dto/user-response.dto';

export const firstDateInclude = {
  createdBy: true,
} satisfies Prisma.FirstDateInclude;

export type FirstDateEntity = FirstDate & { createdBy: User };

export class FirstDateResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) familyId: string;
  @ApiProperty() name: string;
  @ApiProperty({ type: String, format: 'date', example: '2024-08-15' }) date: Date;
  @ApiPropertyOptional({ type: String, nullable: true }) description: string | null;
  @ApiProperty({ minimum: 1 }) version: number;
  @ApiProperty({ type: UserResponseDto }) createdBy: UserResponseDto;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  static fromEntity(firstDate: FirstDateEntity): FirstDateResponseDto {
    return {
      id: firstDate.id,
      familyId: firstDate.familyId,
      name: firstDate.name,
      date: firstDate.date,
      description: firstDate.description,
      version: firstDate.version,
      createdBy: UserResponseDto.fromEntity(firstDate.createdBy),
      createdAt: firstDate.createdAt,
      updatedAt: firstDate.updatedAt,
    };
  }
}
