import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Patch,
  Delete,
  Query,
  Req,
  UseGuards,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { MessengerService } from './messenger.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { MessagesQueryDto } from './dto/messages-query.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { ConversationMemberDto } from './dto/conversation-member.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { MediaResponseDto } from '../media/dto/media-response.dto';
import { MediaService } from '../media/media.service';
import { Readable } from 'node:stream';

@ApiTags('messenger')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class MessengerController {
  constructor(
    private readonly messenger: MessengerService,
    private readonly mediaService: MediaService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a direct conversation or group' })
  create(@Req() req: Request & { user: AuthenticatedUser }, @Body() dto: CreateConversationDto) {
    return this.messenger.createConversation(req.user.id, dto);
  }

  @Get()
  list(@Req() req: Request & { user: AuthenticatedUser }) {
    return this.messenger.listConversations(req.user.id);
  }

  @Get(':conversationId')
  get(
    @Req() req: Request & { user: AuthenticatedUser },
    @Param('conversationId', ParseUUIDPipe) id: string,
  ) {
    return this.messenger.requireConversation(req.user.id, id);
  }

  @Patch(':conversationId')
  update(
    @Req() req: Request & { user: AuthenticatedUser },
    @Param('conversationId', ParseUUIDPipe) id: string,
    @Body() dto: UpdateConversationDto,
  ) {
    return this.messenger.updateConversation(req.user.id, id, dto.title);
  }

  @Post(':conversationId/members')
  addMember(
    @Req() req: Request & { user: AuthenticatedUser },
    @Param('conversationId', ParseUUIDPipe) id: string,
    @Body() dto: ConversationMemberDto,
  ) {
    return this.messenger.addMember(req.user.id, id, dto.userId);
  }

  @Delete(':conversationId/members/:userId')
  removeMember(
    @Req() req: Request & { user: AuthenticatedUser },
    @Param('conversationId', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) memberId: string,
  ) {
    return this.messenger.removeMember(req.user.id, id, memberId);
  }

  @Post(':conversationId/leave')
  leave(
    @Req() req: Request & { user: AuthenticatedUser },
    @Param('conversationId', ParseUUIDPipe) id: string,
  ) {
    return this.messenger.leaveConversation(req.user.id, id);
  }

  @Get(':conversationId/messages')
  messages(
    @Req() req: Request & { user: AuthenticatedUser },
    @Param('conversationId', ParseUUIDPipe) id: string,
    @Query() query: MessagesQueryDto,
  ) {
    return this.messenger.getMessages(req.user.id, id, query);
  }

  @Get(':conversationId/messages/:messageId/media')
  @ApiOperation({ summary: 'List media attached to a conversation message' })
  @ApiOkResponse({ type: MediaResponseDto, isArray: true })
  messageMedia(
    @Req() req: Request & { user: AuthenticatedUser },
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ) {
    return this.messenger.getMessageMedia(req.user.id, conversationId, messageId);
  }

  @Get(':conversationId/messages/:messageId/media/:mediaId/stream')
  @ApiOperation({ summary: 'Stream media attached to a conversation message' })
  @ApiProduces('application/octet-stream')
  @ApiHeader({ name: 'Range', required: false, description: 'Optional byte range' })
  streamMessageMedia(
    @Req() req: Request & { user: AuthenticatedUser },
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Param('mediaId', ParseUUIDPipe) mediaId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    return this.createMessageMediaStream(
      req.user.id,
      conversationId,
      messageId,
      mediaId,
      req,
      response,
      false,
    );
  }

  @Get(':conversationId/messages/:messageId/media/:mediaId/download')
  @ApiOperation({ summary: 'Download media attached to a conversation message' })
  @ApiProduces('application/octet-stream')
  @ApiHeader({ name: 'Range', required: false, description: 'Optional byte range' })
  downloadMessageMedia(
    @Req() req: Request & { user: AuthenticatedUser },
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Param('mediaId', ParseUUIDPipe) mediaId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    return this.createMessageMediaStream(
      req.user.id,
      conversationId,
      messageId,
      mediaId,
      req,
      response,
      true,
    );
  }

  @Post(':conversationId/messages')
  message(
    @Req() req: Request & { user: AuthenticatedUser },
    @Param('conversationId', ParseUUIDPipe) id: string,
    @Body() dto: CreateMessageDto,
  ) {
    return this.messenger.createMessage(req.user.id, id, dto);
  }

  @Patch(':conversationId/messages/:messageId')
  updateMessage(
    @Req() req: Request & { user: AuthenticatedUser },
    @Param('conversationId', ParseUUIDPipe) id: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body() dto: UpdateMessageDto,
  ) {
    return this.messenger.updateMessage(req.user.id, id, messageId, dto.text);
  }

  @Delete(':conversationId/messages/:messageId')
  deleteMessage(
    @Req() req: Request & { user: AuthenticatedUser },
    @Param('conversationId', ParseUUIDPipe) id: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ) {
    return this.messenger.deleteMessage(req.user.id, id, messageId);
  }

  private async createMessageMediaStream(
    userId: string,
    conversationId: string,
    messageId: string,
    mediaId: string,
    request: Request,
    response: Response,
    download: boolean,
  ): Promise<StreamableFile> {
    await this.messenger.requireMessageMedia(userId, conversationId, messageId, mediaId);
    const object = await this.mediaService.stream(userId, mediaId, request.headers.range, download);
    response.status(object.contentRange ? 206 : 200);
    response.setHeader('Accept-Ranges', 'bytes');
    response.setHeader('Content-Type', object.mimeType);
    response.setHeader('Content-Length', object.contentLength);
    if (object.contentRange) response.setHeader('Content-Range', object.contentRange);
    if (download) {
      response.setHeader(
        'Content-Disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(object.originalName)}`,
      );
    }
    return new StreamableFile(object.body as Readable, {
      type: object.mimeType,
      length: object.contentLength,
    });
  }
}
