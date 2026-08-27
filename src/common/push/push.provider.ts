import type { PushDeviceDelivery } from '../outbox/outbox.types';

export const PUSH_PROVIDER = Symbol('PUSH_PROVIDER');

export interface PushNotification {
  title: string;
  body: string;
  data: Record<string, string>;
}

export interface PushProvider {
  sendToDevices(input: {
    devices: PushDeviceDelivery[];
    notification: PushNotification;
  }): Promise<{ invalidDeviceIds: string[] }>;
}
