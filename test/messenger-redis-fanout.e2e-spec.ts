import { io, type Socket } from 'socket.io-client';
import type { Server } from 'socket.io';
import { RedisIoAdapter } from '../src/common/websocket/redis-io.adapter';

const redisUrl = process.env.MESSENGER_REDIS_URL;
const redisTest = redisUrl ? it : it.skip;

describe('Messenger Redis fan-out', () => {
  jest.setTimeout(15_000);

  function portOf(server: Server): number {
    const address = server.httpServer.address();
    if (!address || typeof address === 'string')
      throw new Error('Socket.IO server is not listening');
    return address.port;
  }

  function waitFor<T>(socket: Socket, event: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), 5_000);
      socket.once(event, (payload: T) => {
        clearTimeout(timer);
        resolve(payload);
      });
      socket.once('connect_error', (error: Error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  redisTest('broadcasts events between two Socket.IO instances', async () => {
    const adapterA = new RedisIoAdapter();
    const adapterB = new RedisIoAdapter();
    await Promise.all([adapterA.connectToRedis(redisUrl!), adapterB.connectToRedis(redisUrl!)]);

    const serverA = adapterA.createIOServer(0);
    const serverB = adapterB.createIOServer(0);
    const namespaceA = serverA.of('/messenger');
    const namespaceB = serverB.of('/messenger');
    namespaceA.on('connection', (socket) => void socket.join('conversation:fan-out'));
    namespaceB.on('connection', (socket) => void socket.join('conversation:fan-out'));

    const clientA = io(`http://127.0.0.1:${portOf(serverA)}/messenger`, {
      transports: ['websocket'],
    });
    const clientB = io(`http://127.0.0.1:${portOf(serverB)}/messenger`, {
      transports: ['websocket'],
    });

    try {
      await Promise.all([waitFor(clientA, 'connect'), waitFor(clientB, 'connect')]);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const received = waitFor<{ source: string; value: string }>(clientB, 'message.created');
      namespaceA.to('conversation:fan-out').emit('message.created', {
        source: 'instance-a',
        value: 'redis-delivery',
      });

      await expect(received).resolves.toEqual({ source: 'instance-a', value: 'redis-delivery' });
    } finally {
      clientA.close();
      clientB.close();
      await Promise.all([adapterA.close(serverA), adapterB.close(serverB)]);
    }
  });
});
