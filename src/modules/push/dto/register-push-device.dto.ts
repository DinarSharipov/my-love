import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export enum PushDevicePlatformDto {
  ANDROID = 'android',
  IOS = 'ios',
}

export class RegisterPushDeviceDto {
  @ApiProperty({ minLength: 1, maxLength: 4096 })
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  token!: string;

  @ApiProperty({ enum: PushDevicePlatformDto })
  @IsEnum(PushDevicePlatformDto)
  platform!: PushDevicePlatformDto;

  @ApiPropertyOptional({ maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  appVersion?: string;
}
