import { ApiProperty } from '@nestjs/swagger';

export class PasswordResetRequestResponseDto {
  @ApiProperty({ example: 'If the account exists, password reset instructions have been sent.' })
  message: string;
}
