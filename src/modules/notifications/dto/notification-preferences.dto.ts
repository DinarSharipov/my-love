import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, Matches } from 'class-validator';
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
export class UpdateNotificationPreferencesDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() inAppEnabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() emailEnabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() telegramEnabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() quietHoursEnabled?: boolean;
  @ApiPropertyOptional({ example: '22:00', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' })
  @IsOptional()
  @Matches(timePattern)
  quietHoursStart?: string;
  @ApiPropertyOptional({ example: '08:00', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' })
  @IsOptional()
  @Matches(timePattern)
  quietHoursEnd?: string;
}
export class NotificationPreferencesResponseDto {
  @ApiProperty() inAppEnabled: boolean;
  @ApiProperty() emailEnabled: boolean;
  @ApiProperty() telegramEnabled: boolean;
  @ApiProperty() quietHoursEnabled: boolean;
  @ApiPropertyOptional({ nullable: true }) quietHoursStart: string | null;
  @ApiPropertyOptional({ nullable: true }) quietHoursEnd: string | null;
}
