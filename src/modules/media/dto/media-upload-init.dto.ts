import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Max, MaxLength, Min } from 'class-validator';

export class MediaUploadInitDto {
  @ApiProperty({ maxLength: 255 })
  @IsString()
  @MaxLength(255)
  originalName: string;

  @ApiProperty({ maxLength: 127 })
  @IsString()
  @MaxLength(127)
  mimeType: string;

  @ApiProperty({ minimum: 1, maximum: 524288000 })
  @IsInt()
  @Min(1)
  @Max(524288000)
  sizeBytes: number;
}
