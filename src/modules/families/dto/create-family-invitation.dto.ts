import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateFamilyInvitationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  recipientId: string;
}
