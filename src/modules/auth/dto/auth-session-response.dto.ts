import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { AuthSession } from '@prisma/client';

export class AuthSessionResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiPropertyOptional({ type: String, nullable: true }) ipAddress: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) userAgent: string | null;
  @ApiProperty() lastSeenAt: Date;
  @ApiProperty() expiresAt: Date;
  @ApiProperty() createdAt: Date;
  @ApiProperty() isCurrent: boolean;

  static fromEntity(session: AuthSession, currentTokenHash: string): AuthSessionResponseDto {
    return {
      id: session.id,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      lastSeenAt: session.lastSeenAt,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      isCurrent: session.tokenHash === currentTokenHash,
    };
  }
}
