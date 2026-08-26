import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient, RedisClientType } from 'redis';
import type { Server, ServerOptions } from 'socket.io';

type RedisClient = RedisClientType;

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor?: ReturnType<typeof createAdapter>;
  private pubClient?: RedisClient;
  private subClient?: RedisClient;

  async connectToRedis(url: string): Promise<void> {
    this.pubClient = createClient({ url });
    this.subClient = this.pubClient.duplicate();
    await Promise.all([this.pubClient.connect(), this.subClient.connect()]);
    this.adapterConstructor = createAdapter(this.pubClient, this.subClient);
  }

  override createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, options) as Server;
    if (this.adapterConstructor) server.adapter(this.adapterConstructor);
    return server;
  }

  override async close(server: Server): Promise<void> {
    await super.close(server);
    await Promise.all([
      this.pubClient?.isOpen ? this.pubClient.quit() : undefined,
      this.subClient?.isOpen ? this.subClient.quit() : undefined,
    ]);
  }
}
