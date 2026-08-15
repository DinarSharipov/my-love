import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class AcceptPrivateFamilyInvitationDto {
  @ApiProperty({ description: 'One-time token from the invitation link' })
  @IsString()
  @MinLength(32)
  @MaxLength(256)
  token: string;
}
