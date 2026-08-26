import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
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
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
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
import {
  ConversationResponseDto,
  OperationSuccessResponseDto,
  ReadStateResponseDto,
} from './dto/conversation-response.dto';
import { MessagePageResponseDto, MessageResponseDto } from './dto/message-response.dto';
import { TransferConversationOwnershipDto } from './dto/transfer-conversation-ownership.dto';
import { MessengerGateway } from './messenger.gateway';

@ApiTags('messenger')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class MessengerController {
  constructor(
    private readonly messenger: MessengerService,
    private readonly mediaService: MediaService,
    private readonly gateway: MessengerGateway,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a direct conversation or group' })
  @ApiCreatedResponse({ type: ConversationResponseDto })
  async create(
    @Req() req: Request & { user: AuthenticatedUser },
    @Body() dto: CreateConversationDto,
  ) {
    const conversation = await this.messenger.createConversation(req.user.id, dto);
    this.gateway.publishConversationCreated(conversation);
    return conversation;
  }

  @Get()
  @ApiOkResponse({ type: ConversationResponseDto, isArray: true })
  list(@Req() req: Request & { user: AuthenticatedUser }) {
    return this.messenger.listConversations(req.user.id);
  }

  @Get(':conversationId')
  @ApiOkResponse({ type: ConversationResponseDto })
  get(
    @Req() req: Request & { user: AuthenticatedUser },
    @Param('conversationId', ParseUUIDPipe) id: string,
  ) {
    return this.messenger.getConversation(req.user.id, id);
  }

  @Patch(':conversationId')
  @ApiOkResponse({ type: ConversationResponseDto })
  async update(
    @Req() req: Request & { user: AuthenticatedUser },
    @Param('conversationId', ParseUUIDPipe) id: string,
    @Body() dto: UpdateConversationDto,
  ) {
    const conversation = await this.messenger.updateConversation(req.user.id, id, dto.title);
    this.gateway.publishConversationUpdated(conversation);
    return conversation;
  }

  @Post(':conversationId/members')
  @ApiCreatedResponse({ type: ConversationResponseDto })
  async addMember(
    @Req() req: Request & { user: AuthenticatedUser },
    @Param('conversationId', ParseUUIDPipe) id: string,
    @Body() dto: ConversationMemberDto,
  ) {
    const conversation = await this.messenger.addMember(req.user.id, id, dto.userId);
    this.gateway.publishConversationUpdated(conversation);
    return conversation;
  }

  @Delete(':conversationId/members/:userId')
  @ApiOkResponse({ type: ConversationResponseDto })
  async removeMember(
    @Req() req: Request & { user: AuthenticatedUser },
    @Param('conversationId', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) memberId: string,
  ) {
    const conversation = await this.messenger.removeMember(req.user.id, id, memberId);
    this.gateway.publishConversationUpdated(conversation);
    return conversation;
  }

  @Post(':conversationId/ownership')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Transfer group ownership to an existing member' })
  @ApiOkResponse({ type: ConversationResponseDto })
  async transferOwnership(
    @Req() req: Request & { user: AuthenticatedUser },
    @Param('conversationId', ParseUUIDPipe) id: string,
    @Body() dto: TransferConversationOwnershipDto,
  ) {
    const conversation = await this.messenger.transferOwnership(req.user.id, id, dto);
    this.gateway.publishConversationUpdated(conversation);
    return conversation;
  }

  @Post(':conversationId/leave')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: OperationSuccessResponseDto })
  leave(
    @Req() req: Request & { user: AuthenticatedUser },
    @Param('conversationId', ParseUUIDPipe) id: string,
  ) {
    return this.messenger.leaveConversation(req.user.id, id);
  }

  @Get(':conversationId/messages')
  @ApiOkResponse({ type: MessagePageResponseDto })
  @ApiQuery({ name: 'limit', required: false, type: Number, minimum: 1, maximum: 100 })
  @ApiQuery({ name: 'beforeId', required: false, type: String, format: 'uuid' })
  @ApiQuery({ name: 'afterId', required: false, type: String, format: 'uuid' })
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
  @ApiCreatedResponse({ type: MessageResponseDto })
  async message(
    @Req() req: Request & { user: AuthenticatedUser },
    @Param('conversationId', ParseUUIDPipe) id: string,
    @Body() dto: CreateMessageDto,
  ) {
    const message = await this.messenger.createMessage(req.user.id, id, dto);
    this.gateway.publishMessageCreated(id, message);
    return message;
  }

  @Post(':conversationId/messages/:messageId/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a message as read without WebSocket' })
  @ApiOkResponse({ type: ReadStateResponseDto })
  async markRead(
    @Req() req: Request & { user: AuthenticatedUser },
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ): Promise<ReadStateResponseDto> {
    const read = await this.messenger.markRead(req.user.id, conversationId, messageId);
    const response = { conversationId, messageId, readAt: read.lastReadAt! };
    this.gateway.publishMessageRead({ ...response, userId: req.user.id });
    return response;
  }

  @Patch(':conversationId/messages/:messageId')
  @ApiOkResponse({ type: MessageResponseDto })
  async updateMessage(
    @Req() req: Request & { user: AuthenticatedUser },
    @Param('conversationId', ParseUUIDPipe) id: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body() dto: UpdateMessageDto,
  ) {
    const message = await this.messenger.updateMessage(req.user.id, id, messageId, dto.text);
    this.gateway.publishMessageUpdated(id, message);
    return message;
  }

  @Delete(':conversationId/messages/:messageId')
  @ApiOkResponse({ type: MessageResponseDto })
  async deleteMessage(
    @Req() req: Request & { user: AuthenticatedUser },
    @Param('conversationId', ParseUUIDPipe) id: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ) {
    const message = await this.messenger.deleteMessage(req.user.id, id, messageId);
    this.gateway.publishMessageDeleted(id, message);
    return message;
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
