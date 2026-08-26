import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class TransferConversationOwnershipDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  userId!: string;
}
