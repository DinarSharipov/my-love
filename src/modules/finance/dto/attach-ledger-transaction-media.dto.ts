import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AttachLedgerTransactionMediaDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  mediaId: string;
}
