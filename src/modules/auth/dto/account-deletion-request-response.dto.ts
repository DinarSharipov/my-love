import { ApiProperty } from '@nestjs/swagger';

export class AccountDeletionRequestResponseDto {
  @ApiProperty({ format: 'date-time' })
  scheduledFor: Date;
}
