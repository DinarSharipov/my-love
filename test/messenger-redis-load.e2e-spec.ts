import { io, type Socket } from 'socket.io-client';
import type { Server } from 'socket.io';
import { RedisIoAdapter } from '../src/common/websocket/redis-io.adapter';

const redisUrl = process.env.MESSENGER_REDIS_URL;
const redisTest = redisUrl ? it : it.skip;
const room = 'conversation:load-smoke';

function positiveInt(name: string, fallback: number, max: number): number {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isInteger(value) && value > 0 ? Math.min(value, max) : fallback;
}

describe('Messenger Redis load smoke', () => {
  jest.setTimeout(30_000);

  function portOf(server: Server): number {
    const address = server.httpServer.address();
    if (!address || typeof address === 'string')
      throw new Error('Socket.IO server is not listening');
    return address.port;
  }

  function waitForConnect(socket: Socket): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Timed out connecting Socket.IO client')),
        5_000,
      );
      socket.once('connect', () => {
        clearTimeout(timer);
        resolve();
      });
      socket.once('connect_error', (error: Error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  function waitForMessages(socket: Socket, expected: number): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      let received = 0;
      const onMessage = () => {
        received += 1;
        if (received !== expected) return;
        clearTimeout(timer);
        socket.off('message.created', onMessage);
        resolve(received);
      };
      const timer = setTimeout(() => {
        socket.off('message.created', onMessage);
        reject(new Error(`Timed out waiting for ${expected} messages; received ${received}`));
      }, 10_000);
      socket.on('message.created', onMessage);
    });
  }

  redisTest('delivers a burst to clients on both Socket.IO instances', async () => {
    const clientsPerInstance = positiveInt('MESSENGER_REDIS_LOAD_CLIENTS', 2, 10);
    const messages = positiveInt('MESSENGER_REDIS_LOAD_MESSAGES', 100, 1_000);
    const adapterA = new RedisIoAdapter();
    const adapterB = new RedisIoAdapter();
    await Promise.all([adapterA.connectToRedis(redisUrl!), adapterB.connectToRedis(redisUrl!)]);

    const serverA = adapterA.createIOServer(0);
    const serverB = adapterB.createIOServer(0);
    const namespaceA = serverA.of('/messenger');
    const namespaceB = serverB.of('/messenger');
    namespaceA.on('connection', (socket) => void socket.join(room));
    namespaceB.on('connection', (socket) => void socket.join(room));

    const clientsA = Array.from({ length: clientsPerInstance }, () =>
      io(`http://127.0.0.1:${portOf(serverA)}/messenger`, { transports: ['websocket'] }),
    );
    const clientsB = Array.from({ length: clientsPerInstance }, () =>
      io(`http://127.0.0.1:${portOf(serverB)}/messenger`, { transports: ['websocket'] }),
    );
    const clients = [...clientsA, ...clientsB];

    try {
      await Promise.all(clients.map(waitForConnect));
      await new Promise((resolve) => setTimeout(resolve, 100));
      const receiveChecks = clients.map((socket) => waitForMessages(socket, messages));
      const startedAt = Date.now();

      for (let index = 0; index < messages; index += 1) {
        namespaceA.to(room).emit('message.created', { messageId: `load-${index}` });
      }

      await expect(Promise.all(receiveChecks)).resolves.toEqual(
        Array.from({ length: clients.length }, () => messages),
      );
      expect(Date.now() - startedAt).toBeLessThan(10_000);
    } finally {
      clients.forEach((client) => client.close());
      await Promise.all([adapterA.close(serverA), adapterB.close(serverB)]);
    }
  });
});
