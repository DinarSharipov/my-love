import { ApiProperty } from '@nestjs/swagger';

export class MediaResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) userId: string;
  @ApiProperty() originalName: string;
  @ApiProperty() mimeType: string;
  @ApiProperty() sizeBytes: number;
  @ApiProperty() createdAt: Date;
  @ApiProperty({ description: 'Short-lived URL for downloading the private object' })
  downloadUrl: string;
  @ApiProperty({
    nullable: true,
    description: 'Short-lived URL for a 320px WebP image preview; null for videos',
  })
  previewUrl: string | null;
}
