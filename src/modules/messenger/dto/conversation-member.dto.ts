import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class ConversationMemberDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  userId!: string;
}
