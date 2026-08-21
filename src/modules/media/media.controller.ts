import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Body,
  Req,
  Res,
  StreamableFile,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { VIDEO_MIME_TYPES } from './media.constants';
import { AUDIO_MIME_TYPES } from './media.constants';
import { MediaUploadCompleteDto } from './dto/media-upload-complete.dto';
import { MediaUploadInitDto } from './dto/media-upload-init.dto';
import { MediaUploadResponseDto, MediaUploadStatusDto } from './dto/media-upload-response.dto';
import type { Request, Response } from 'express';
import { Readable } from 'node:stream';
import { MediaKind } from '@prisma/client';
import { MediaQueryDto } from './dto/media-query.dto';
import { MediaResponseDto } from './dto/media-response.dto';
import { PaginatedMediaResponseDto } from './dto/paginated-media-response.dto';
import { MediaService } from './media.service';

@ApiTags('media')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'media', version: '1' })
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload an image, video or audio (legacy API)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOkResponse({ type: MediaResponseDto })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: tmpdir(),
        filename: (_request, file, callback) =>
          callback(null, `${randomUUID()}-${file.originalname}`),
      }),
      limits: { fileSize: 500 * 1024 * 1024 },
      fileFilter: (_request, file, callback) => {
        const accepted =
          file.mimetype.startsWith('image/') ||
          VIDEO_MIME_TYPES.has(file.mimetype) ||
          AUDIO_MIME_TYPES.has(file.mimetype);
        callback(
          accepted ? null : new BadRequestException('Unsupported image, video or audio format'),
          accepted,
        );
      },
    }),
  )
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<MediaResponseDto> {
    if (!file) throw new BadRequestException('File is required');
    return this.mediaService.create(user.id, file);
  }

  @Post('uploads/initiate')
  @ApiOperation({ summary: 'Initiate direct S3 multipart upload with progress support' })
  @ApiOkResponse({ type: MediaUploadResponseDto })
  initiateUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: MediaUploadInitDto,
  ): Promise<MediaUploadResponseDto> {
    return this.mediaService.initiateUpload(user.id, input);
  }

  @Get('uploads/:id/status')
  @ApiOperation({ summary: 'Get direct S3 multipart upload progress' })
  @ApiOkResponse({ type: MediaUploadStatusDto })
  uploadStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MediaUploadStatusDto> {
    return this.mediaService.getUploadStatus(user.id, id);
  }

  @Post('uploads/:id/complete')
  @ApiOperation({ summary: 'Complete direct S3 multipart upload' })
  @ApiOkResponse({ type: MediaResponseDto })
  completeUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: MediaUploadCompleteDto,
  ): Promise<MediaResponseDto> {
    return this.mediaService.completeUpload(user.id, id, input.parts);
  }

  @Delete('uploads/:id')
  @ApiOperation({ summary: 'Abort direct S3 multipart upload' })
  abortUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ aborted: true }> {
    return this.mediaService.abortUpload(user.id, id).then(() => ({ aborted: true }));
  }

  @Get()
  @ApiOperation({ summary: 'List media shared with the current family' })
  @ApiOkResponse({ type: PaginatedMediaResponseDto })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: MediaQueryDto,
  ): Promise<PaginatedMediaResponseDto> {
    return this.mediaService.findMany(user.id, query);
  }

  @Get('videos/:id/stream')
  @Get('audio/:id/stream')
  @ApiOperation({ summary: 'Stream a family video or audio object; supports HTTP Range' })
  streamMedia(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    return this.createStream(
      user.id,
      id,
      request,
      response,
      false,
      request.path.includes('/audio/') ? MediaKind.AUDIO : MediaKind.VIDEO,
    );
  }

  @Get('videos/:id/download')
  @Get('audio/:id/download')
  @ApiOperation({ summary: 'Download a family video or audio object' })
  downloadMedia(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    return this.createStream(
      user.id,
      id,
      request,
      response,
      true,
      request.path.includes('/audio/') ? MediaKind.AUDIO : MediaKind.VIDEO,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one media item shared with the current family' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: MediaResponseDto })
  @ApiNotFoundResponse()
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MediaResponseDto> {
    return this.mediaService.findOne(user.id, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete one media item uploaded by the current user' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ schema: { example: { deleted: true } } })
  @ApiNotFoundResponse()
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ deleted: true }> {
    await this.mediaService.remove(user.id, id);
    return { deleted: true };
  }

  private async createStream(
    userId: string,
    id: string,
    request: Request,
    response: Response,
    download: boolean,
    expectedKind: MediaKind,
  ): Promise<StreamableFile> {
    const object = await this.mediaService.stream(
      userId,
      id,
      request.headers.range,
      download,
      expectedKind,
    );
    response.status(object.contentRange ? 206 : 200);
    response.setHeader('Accept-Ranges', 'bytes');
    response.setHeader('Content-Type', object.mimeType);
    response.setHeader('Content-Length', object.contentLength);
    if (object.contentRange) response.setHeader('Content-Range', object.contentRange);
    if (download)
      response.setHeader(
        'Content-Disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(object.originalName)}`,
      );
    return new StreamableFile(object.body as Readable, {
      type: object.mimeType,
      length: object.contentLength,
    });
  }
}
