import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ConfirmEmailChangeDto {
  @ApiProperty({ description: 'One-time email change token' })
  @IsString()
  @MinLength(32)
  @MaxLength(512)
  token: string;
}
