import { ApiProperty } from '@nestjs/swagger';

export class MediaUploadPartResponseDto {
  @ApiProperty() partNumber: number;
  @ApiProperty() url: string;
}

export class MediaUploadResponseDto {
  @ApiProperty({ format: 'uuid' }) sessionId: string;
  @ApiProperty() objectKey: string;
  @ApiProperty() partSizeBytes: number;
  @ApiProperty({ type: [MediaUploadPartResponseDto] }) parts: MediaUploadPartResponseDto[];
  @ApiProperty() expiresAt: Date;
}

export class MediaUploadStatusDto {
  @ApiProperty({ enum: ['INITIATED', 'COMPLETED', 'ABORTED', 'FAILED'] }) status: string;
  @ApiProperty() uploadedBytes: number;
  @ApiProperty() totalBytes: number;
}
