import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { S3StorageService } from './s3-storage.service';

@Module({
  controllers: [MediaController],
  providers: [MediaService, S3StorageService],
})
export class MediaModule {}
