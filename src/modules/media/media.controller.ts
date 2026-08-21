import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
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
  @ApiOperation({ summary: 'Upload an image or video' })
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
        const accepted = file.mimetype.startsWith('image/') || VIDEO_MIME_TYPES.has(file.mimetype);
        callback(
          accepted ? null : new BadRequestException('Unsupported image or video format'),
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

  @Get()
  @ApiOperation({ summary: 'List current user media' })
  @ApiOkResponse({ type: PaginatedMediaResponseDto })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: MediaQueryDto,
  ): Promise<PaginatedMediaResponseDto> {
    return this.mediaService.findMany(user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one current user media item' })
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
  @ApiOperation({ summary: 'Delete one current user media item' })
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
}
