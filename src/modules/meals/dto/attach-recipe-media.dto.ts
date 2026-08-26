import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AttachRecipeMediaDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  mediaId: string;
}
