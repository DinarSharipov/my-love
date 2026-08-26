import { UsePipes, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { WsException } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { MessengerService } from './messenger.service';
import {
  ConversationEventDto,
  EditMessageEventDto,
  MessageEventDto,
  ReadMessageEventDto,
  SendMessageEventDto,
} from './dto/ws-events.dto';

type AuthenticatedSocket = Socket & { user: AuthenticatedUser };

@WebSocketGateway({ namespace: '/messenger', cors: { origin: true, credentials: true } })
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class MessengerGateway {
  @WebSocketServer() server!: Server;
  private readonly socketConversations = new Map<string, Set<string>>();
  private readonly typingTimers = new Map<string, NodeJS.Timeout>();
  private readonly socketAuthentication = new Map<string, Promise<void>>();

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly messenger: MessengerService,
  ) {}

  async handleConnection(socket: AuthenticatedSocket) {
    const authentication = this.authenticateSocket(socket);
    this.socketAuthentication.set(socket.id, authentication);
    try {
      await authentication;
      this.socketConversations.set(socket.id, new Set());
    } catch {
      socket.disconnect(true);
      this.socketAuthentication.delete(socket.id);
    }
  }

  handleDisconnect(socket: AuthenticatedSocket) {
    const conversations = this.socketConversations.get(socket.id) ?? new Set<string>();
    for (const conversationId of conversations) {
      this.server.to(`conversation:${conversationId}`).emit('presence.updated', {
        userId: socket.user?.id,
        status: 'offline',
      });
      this.clearTyping(socket.id, conversationId);
    }
    this.socketConversations.delete(socket.id);
    this.socketAuthentication.delete(socket.id);
  }

  @SubscribeMessage('conversation.join')
  async join(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() body: ConversationEventDto,
  ) {
    try {
      await this.requireAuthenticated(socket);
      await this.messenger.getFamilyId(socket.user.id, body.conversationId);
      await socket.join(`conversation:${body.conversationId}`);
      this.socketConversations.get(socket.id)?.add(body.conversationId);
      this.server.to(`conversation:${body.conversationId}`).emit('presence.updated', {
        userId: socket.user.id,
        status: 'online',
      });
      return { ok: true, conversationId: body.conversationId };
    } catch (error) {
      throw new WsException(this.error(error));
    }
  }

  @SubscribeMessage('conversation.leave')
  async leave(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() body: ConversationEventDto,
  ) {
    await this.requireAuthenticated(socket);
    await this.messenger.getFamilyId(socket.user.id, body.conversationId);
    await socket.leave(`conversation:${body.conversationId}`);
    this.socketConversations.get(socket.id)?.delete(body.conversationId);
    this.clearTyping(socket.id, body.conversationId);
    this.server.to(`conversation:${body.conversationId}`).emit('presence.updated', {
      userId: socket.user.id,
      status: 'offline',
    });
    return { ok: true, conversationId: body.conversationId };
  }

  @SubscribeMessage('typing.start')
  async typingStart(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() body: ConversationEventDto,
  ) {
    try {
      await this.requireAuthenticated(socket);
      await this.messenger.getFamilyId(socket.user.id, body.conversationId);
      await socket.join(`conversation:${body.conversationId}`);
      this.socketConversations.get(socket.id)?.add(body.conversationId);
      this.server.to(`conversation:${body.conversationId}`).emit('typing.updated', {
        userId: socket.user.id,
        conversationId: body.conversationId,
        isTyping: true,
      });
      this.clearTyping(socket.id, body.conversationId);
      this.typingTimers.set(
        this.typingKey(socket.id, body.conversationId),
        setTimeout(() => {
          this.emitTyping(socket, body.conversationId, false);
        }, 5000),
      );
      return { ok: true };
    } catch (error) {
      throw new WsException(this.error(error));
    }
  }

  @SubscribeMessage('typing.stop')
  async typingStop(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() body: ConversationEventDto,
  ) {
    try {
      await this.messenger.getFamilyId(socket.user.id, body.conversationId);
      this.emitTyping(socket, body.conversationId, false);
      return { ok: true };
    } catch (error) {
      throw new WsException(this.error(error));
    }
  }

  @SubscribeMessage('message.send')
  async send(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() body: SendMessageEventDto,
  ) {
    try {
      await this.requireAuthenticated(socket);
      const message = await this.messenger.createMessage(
        socket.user.id,
        body.conversationId,
        body.message,
      );
      this.server.to(`conversation:${body.conversationId}`).emit('message.created', message);
      return { ok: true, message };
    } catch (error) {
      throw new WsException(this.error(error));
    }
  }

  @SubscribeMessage('message.read')
  async read(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() body: ReadMessageEventDto,
  ) {
    try {
      await this.requireAuthenticated(socket);
      const read = await this.messenger.markRead(
        socket.user.id,
        body.conversationId,
        body.messageId,
      );
      this.server.to(`conversation:${body.conversationId}`).emit('message.read', {
        conversationId: body.conversationId,
        userId: socket.user.id,
        messageId: body.messageId,
        readAt: read.lastReadAt,
      });
      return { ok: true };
    } catch (error) {
      throw new WsException(this.error(error));
    }
  }

  @SubscribeMessage('message.edit')
  async edit(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() body: EditMessageEventDto,
  ) {
    try {
      await this.requireAuthenticated(socket);
      const message = await this.messenger.updateMessage(
        socket.user.id,
        body.conversationId,
        body.messageId,
        body.text,
      );
      this.server.to(`conversation:${body.conversationId}`).emit('message.updated', message);
      return { ok: true, message };
    } catch (error) {
      throw new WsException(this.error(error));
    }
  }

  @SubscribeMessage('message.delete')
  async delete(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() body: MessageEventDto,
  ) {
    try {
      await this.requireAuthenticated(socket);
      const message = await this.messenger.deleteMessage(
        socket.user.id,
        body.conversationId,
        body.messageId,
      );
      this.server.to(`conversation:${body.conversationId}`).emit('message.deleted', message);
      return { ok: true, message };
    } catch (error) {
      throw new WsException(this.error(error));
    }
  }

  private error(error: unknown) {
    return {
      code: error instanceof WsException ? 'WS_ERROR' : 'REQUEST_REJECTED',
      message: error instanceof Error ? error.message : 'Request failed',
    };
  }

  private async authenticateSocket(socket: AuthenticatedSocket): Promise<void> {
    const auth = socket.handshake.auth as { token?: unknown };
    const raw = auth.token ?? socket.handshake.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (typeof raw !== 'string' || !raw) throw new Error('Missing token');
    const payload = await this.jwt.verifyAsync<{ sub: string; jti: string }>(raw, {
      secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
    });
    const session = await this.prisma.authSession.findFirst({
      where: {
        tokenHash: createHash('sha256').update(payload.jti).digest('hex'),
        expiresAt: { gt: new Date() },
        userId: payload.sub,
        user: { isActive: true },
      },
      include: { user: true },
    });
    if (!session) throw new Error('Invalid session');
    socket.user = {
      id: session.user.id,
      email: session.user.email,
      tokenHash: session.tokenHash,
    };
  }

  private async requireAuthenticated(socket: AuthenticatedSocket): Promise<void> {
    await this.socketAuthentication.get(socket.id);
    if (!socket.user) throw new Error('Unauthenticated socket');
  }

  private typingKey(socketId: string, conversationId: string) {
    return `${socketId}:${conversationId}`;
  }

  private clearTyping(socketId: string, conversationId: string) {
    const key = this.typingKey(socketId, conversationId);
    const timer = this.typingTimers.get(key);
    if (timer) clearTimeout(timer);
    this.typingTimers.delete(key);
  }

  private emitTyping(socket: AuthenticatedSocket, conversationId: string, isTyping: boolean) {
    this.clearTyping(socket.id, conversationId);
    this.server.to(`conversation:${conversationId}`).emit('typing.updated', {
      userId: socket.user.id,
      conversationId,
      isTyping,
    });
  }
}
