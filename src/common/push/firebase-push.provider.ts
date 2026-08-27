import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';
import type { PushDeviceDelivery } from '../outbox/outbox.types';
import type { PushProvider } from './push.provider';

@Injectable()
export class FirebasePushProvider implements PushProvider {
  private readonly messaging: Messaging;

  constructor(config: ConfigService) {
    const app =
      getApps()[0] ??
      initializeApp({
        credential: cert({
          projectId: config.getOrThrow<string>('FIREBASE_PROJECT_ID'),
          clientEmail: config.getOrThrow<string>('FIREBASE_CLIENT_EMAIL'),
          privateKey: config.getOrThrow<string>('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n'),
        }),
      });
    this.messaging = getMessaging(app);
  }

  async sendToDevices(input: {
    devices: PushDeviceDelivery[];
    notification: { title: string; body: string; data: Record<string, string> };
  }) {
    const response = await this.messaging.sendEachForMulticast({
      tokens: input.devices.map((device) => device.token),
      notification: { title: input.notification.title, body: input.notification.body },
      data: input.notification.data,
    });
    const invalidDeviceIds: string[] = [];
    response.responses.forEach((result, index) => {
      const code = result.error?.code;
      if (
        code === 'messaging/invalid-registration-token' ||
        code === 'messaging/registration-token-not-registered'
      ) {
        invalidDeviceIds.push(input.devices[index].id);
      }
    });
    return { invalidDeviceIds };
  }
}
