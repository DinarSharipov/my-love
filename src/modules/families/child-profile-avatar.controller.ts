import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  Res,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiNotFoundResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Readable } from 'node:stream';
import { ChildProfilesService } from './child-profiles.service';

@ApiTags('child-profiles')
@Controller({ path: 'families/me/children', version: '1' })
export class ChildProfileAvatarController {
  constructor(private readonly children: ChildProfilesService) {}

  @Get(':id/avatar')
  @ApiOperation({ summary: 'Get a child avatar preview' })
  @ApiProduces('image/webp')
  @ApiQuery({
    name: 'token',
    required: true,
    type: String,
    description: 'Avatar preview capability token',
  })
  @ApiHeader({
    name: 'Range',
    required: false,
    description: 'Optional byte range for preview loading',
  })
  @ApiNotFoundResponse()
  async getAvatar(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('token') token: string | undefined,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const object = await this.children.streamAvatar(id, token, request.headers.range);
    response.status(object.contentRange ? 206 : 200);
    response.setHeader('Cache-Control', 'private, max-age=300');
    response.setHeader('Accept-Ranges', 'bytes');
    response.setHeader('Content-Type', 'image/webp');
    response.setHeader('Content-Length', object.contentLength);
    if (object.contentRange) response.setHeader('Content-Range', object.contentRange);
    return new StreamableFile(object.body as Readable, {
      type: 'image/webp',
      length: object.contentLength,
    });
  }
}
