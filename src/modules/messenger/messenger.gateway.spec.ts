import { WsException } from '@nestjs/websockets';
import { createHash } from 'node:crypto';
import { MessengerGateway } from './messenger.gateway';

describe('MessengerGateway', () => {
  const jwt = { verifyAsync: jest.fn() };
  const config = { getOrThrow: jest.fn().mockReturnValue('jwt-secret') };
  const prisma = { authSession: { findFirst: jest.fn() } };
  const messenger = {
    getFamilyId: jest.fn(),
    createMessage: jest.fn(),
    markRead: jest.fn(),
    updateMessage: jest.fn(),
    deleteMessage: jest.fn(),
  };
  const gateway = new MessengerGateway(
    jwt as never,
    config as never,
    prisma as never,
    messenger as never,
  );
  const emit = jest.fn();
  const server = { to: jest.fn().mockReturnValue({ emit }) };

  const socket = (id = 'socket-1') => ({
    id,
    handshake: { auth: {}, headers: {} },
    user: { id: 'user-1', email: 'user@example.test', tokenHash: 'token-hash' },
    join: jest.fn().mockResolvedValue(undefined),
    leave: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    gateway.server = server as never;
    messenger.getFamilyId.mockResolvedValue('family-1');
  });

  it('authenticates a socket with JWT and an active session', async () => {
    const client = socket();
    client.handshake.auth = { token: 'access-token' };
    jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', jti: 'session-jti' });
    prisma.authSession.findFirst.mockResolvedValue({
      tokenHash: createHash('sha256').update('session-jti').digest('hex'),
      user: { id: 'user-1', email: 'user@example.test' },
    });

    await gateway.handleConnection(client as never);

    expect(client.disconnect).not.toHaveBeenCalled();
    expect(client.user).toMatchObject({ id: 'user-1', email: 'user@example.test' });
    expect(prisma.authSession.findFirst).toHaveBeenCalledTimes(1);
  });

  it('disconnects a socket with an invalid session', async () => {
    const client = socket();
    client.handshake.auth = { token: 'expired-token' };
    jwt.verifyAsync.mockRejectedValue(new Error('expired'));

    await gateway.handleConnection(client as never);

    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  it('joins a conversation and broadcasts presence after membership validation', async () => {
    const client = socket();

    await expect(
      gateway.join(client as never, { conversationId: 'conversation-1' }),
    ).resolves.toEqual({
      ok: true,
      conversationId: 'conversation-1',
    });

    expect(messenger.getFamilyId).toHaveBeenCalledWith('user-1', 'conversation-1');
    expect(client.join).toHaveBeenCalledWith('conversation:conversation-1');
    expect(server.to).toHaveBeenCalledWith('conversation:conversation-1');
    expect(emit).toHaveBeenCalledWith('presence.updated', {
      userId: 'user-1',
      status: 'online',
    });
  });

  it('persists the message before broadcasting message.created', async () => {
    const client = socket();
    const message = { id: 'message-1', text: 'hello' };
    messenger.createMessage.mockResolvedValue(message);

    await expect(
      gateway.send(client as never, {
        conversationId: 'conversation-1',
        message: { clientMessageId: 'client-1', type: 'TEXT', text: 'hello' },
      }),
    ).resolves.toEqual({ ok: true, message });

    expect(messenger.createMessage).toHaveBeenCalledWith(
      'user-1',
      'conversation-1',
      expect.any(Object),
    );
    expect(emit).toHaveBeenCalledWith('message.created', message);
  });

  it('emits typing=false automatically after the timeout', async () => {
    jest.useFakeTimers();
    const client = socket();

    try {
      await gateway.typingStart(client as never, { conversationId: 'conversation-1' });
      expect(emit).toHaveBeenCalledWith(
        'typing.updated',
        expect.objectContaining({ isTyping: true }),
      );

      jest.advanceTimersByTime(5000);

      expect(emit).toHaveBeenCalledWith('typing.updated', {
        userId: 'user-1',
        conversationId: 'conversation-1',
        isTyping: false,
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('maps service failures to a WebSocket error contract', async () => {
    const client = socket();
    messenger.getFamilyId.mockRejectedValue(new Error('not a member'));

    await expect(
      gateway.join(client as never, { conversationId: 'conversation-1' }),
    ).rejects.toEqual(new WsException({ code: 'REQUEST_REJECTED', message: 'not a member' }));
  });
});
