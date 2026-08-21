import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListPartsCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createReadStream } from 'node:fs';
import type { ReadStream } from 'node:fs';

@Injectable()
export class S3StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly downloadUrlExpiresIn: number;
  private readonly uploadUrlExpiresIn = 3600;

  constructor(config: ConfigService) {
    this.bucket = config.getOrThrow<string>('S3_BUCKET');
    this.downloadUrlExpiresIn = config.get<number>('S3_PRESIGNED_URL_EXPIRES_IN', 900);
    this.client = new S3Client({
      endpoint: config.getOrThrow<string>('S3_ENDPOINT'),
      region: config.getOrThrow<string>('S3_REGION'),
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.getOrThrow<string>('S3_ACCESS_KEY'),
        secretAccessKey: config.getOrThrow<string>('S3_SECRET_KEY'),
      },
    });
  }

  async uploadFile(
    key: string,
    filePath: string,
    contentType: string,
    contentLength: number,
  ): Promise<void> {
    const body: ReadStream = createReadStream(filePath);
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          ContentLength: contentLength,
        }),
      );
    } catch {
      throw new InternalServerErrorException('Media storage upload failed');
    } finally {
      body.destroy();
    }
  }

  async uploadBuffer(key: string, body: Buffer, contentType: string): Promise<void> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          ContentLength: body.length,
        }),
      );
    } catch {
      throw new InternalServerErrorException('Media storage upload failed');
    }
  }

  async createDownloadUrl(key: string): Promise<string> {
    try {
      return await getSignedUrl(
        this.client,
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
        { expiresIn: this.downloadUrlExpiresIn },
      );
    } catch {
      throw new InternalServerErrorException('Media storage URL generation failed');
    }
  }

  async initiateMultipartUpload(key: string, contentType: string): Promise<string> {
    try {
      const result = await this.client.send(
        new CreateMultipartUploadCommand({
          Bucket: this.bucket,
          Key: key,
          ContentType: contentType,
        }),
      );
      if (!result.UploadId) throw new Error('S3 did not return upload id');
      return result.UploadId;
    } catch {
      throw new InternalServerErrorException('Media multipart upload initiation failed');
    }
  }

  async createPartUploadUrl(key: string, uploadId: string, partNumber: number): Promise<string> {
    try {
      return await getSignedUrl(
        this.client,
        new UploadPartCommand({
          Bucket: this.bucket,
          Key: key,
          UploadId: uploadId,
          PartNumber: partNumber,
        }),
        { expiresIn: this.uploadUrlExpiresIn },
      );
    } catch {
      throw new InternalServerErrorException('Media part URL generation failed');
    }
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: Array<{ PartNumber: number; ETag: string }>,
  ): Promise<void> {
    try {
      await this.client.send(
        new CompleteMultipartUploadCommand({
          Bucket: this.bucket,
          Key: key,
          UploadId: uploadId,
          MultipartUpload: { Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber) },
        }),
      );
    } catch {
      throw new InternalServerErrorException('Media multipart upload completion failed');
    }
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    try {
      await this.client.send(
        new AbortMultipartUploadCommand({ Bucket: this.bucket, Key: key, UploadId: uploadId }),
      );
    } catch {
      throw new InternalServerErrorException('Media multipart upload abort failed');
    }
  }

  async listUploadedParts(
    key: string,
    uploadId: string,
  ): Promise<Array<{ partNumber: number; sizeBytes: number }>> {
    try {
      const result = await this.client.send(
        new ListPartsCommand({ Bucket: this.bucket, Key: key, UploadId: uploadId }),
      );
      return (result.Parts ?? []).map((part) => ({
        partNumber: part.PartNumber ?? 0,
        sizeBytes: part.Size ?? 0,
      }));
    } catch {
      throw new InternalServerErrorException('Media multipart upload status failed');
    }
  }

  async getObjectStream(
    key: string,
    range?: string,
  ): Promise<{
    body: NodeJS.ReadableStream;
    contentLength: number;
    contentRange?: string;
    contentType?: string;
  }> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key, Range: range }),
      );
      if (!result.Body || result.ContentLength === undefined)
        throw new Error('S3 object body missing');
      return {
        body: result.Body as NodeJS.ReadableStream,
        contentLength: result.ContentLength,
        contentRange: result.ContentRange,
        contentType: result.ContentType,
      };
    } catch {
      throw new InternalServerErrorException('Media streaming failed');
    }
  }

  async downloadBuffer(key: string): Promise<Buffer> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (!result.Body) throw new Error('S3 object body missing');
      return Buffer.from(await result.Body.transformToByteArray());
    } catch {
      throw new InternalServerErrorException('Media download failed');
    }
  }

  async headObject(key: string): Promise<{ contentLength: number; contentType?: string }> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (result.ContentLength === undefined) throw new Error('S3 object length missing');
      return { contentLength: result.ContentLength, contentType: result.ContentType };
    } catch {
      throw new InternalServerErrorException('Media metadata lookup failed');
    }
  }

  async deleteFile(key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch {
      throw new InternalServerErrorException('Media storage delete failed');
    }
  }
}
