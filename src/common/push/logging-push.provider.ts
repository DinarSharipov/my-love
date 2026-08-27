import { Injectable, Logger } from '@nestjs/common';
import type { PushProvider } from './push.provider';

@Injectable()
export class LoggingPushProvider implements PushProvider {
  private readonly logger = new Logger(LoggingPushProvider.name);

  sendToDevices(input: Parameters<PushProvider['sendToDevices']>[0]) {
    this.logger.log({
      event: 'push_delivery_mocked',
      deviceCount: input.devices.length,
      // Never log tokens or private message content.
    });
    return Promise.resolve({ invalidDeviceIds: [] });
  }
}
