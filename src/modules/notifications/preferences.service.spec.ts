import { BadRequestException } from '@nestjs/common';
import { NotificationPreferencesService } from './preferences.service';

describe('NotificationPreferencesService', () => {
  const transaction = (tx: object) =>
    jest.fn((callback: (client: object) => unknown) => callback(tx));

  it('rejects enabling quiet hours without both boundaries', async () => {
    const tx = {
      notificationPreference: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn(),
      },
    };
    const service = new NotificationPreferencesService({ $transaction: transaction(tx) } as never);

    await expect(
      service.update('user-id', { quietHoursEnabled: true, quietHoursStart: '22:00' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.notificationPreference.upsert).not.toHaveBeenCalled();
  });

  it('allows enabling previously configured valid quiet hours', async () => {
    const row = {
      quietHoursEnabled: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
    };
    const tx = {
      notificationPreference: {
        findUnique: jest.fn().mockResolvedValue({ ...row, quietHoursEnabled: false }),
        upsert: jest.fn().mockResolvedValue(row),
      },
    };
    const service = new NotificationPreferencesService({ $transaction: transaction(tx) } as never);

    await expect(service.update('user-id', { quietHoursEnabled: true })).resolves.toBe(row);
  });
});
