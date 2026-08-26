import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AttachFamilyEventMediaDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  mediaId: string;
}
