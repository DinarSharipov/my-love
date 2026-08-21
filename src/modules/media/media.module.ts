import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { S3StorageService } from './s3-storage.service';
import { FamilyMembersModule } from '../family-members/family-members.module';

@Module({
  imports: [FamilyMembersModule],
  controllers: [MediaController],
  providers: [MediaService, S3StorageService],
  exports: [S3StorageService],
})
export class MediaModule {}
