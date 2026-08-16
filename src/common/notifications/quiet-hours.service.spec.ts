import { QuietHoursService } from './quiet-hours.service';

describe('QuietHoursService', () => {
  const service = new QuietHoursService();
  const overnight = {
    quietHoursEnabled: true,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
  };

  it('keeps immediate delivery outside quiet hours', () => {
    const now = new Date('2026-08-16T09:00:00.000Z'); // 12:00 Moscow
    expect(service.nextAllowedAt(now, 'Europe/Moscow', overnight)).toEqual(now);
  });

  it('delays an overnight message until the local end boundary', () => {
    const now = new Date('2026-08-16T20:30:00.000Z'); // 23:30 Moscow
    expect(service.nextAllowedAt(now, 'Europe/Moscow', overnight).toISOString()).toBe(
      '2026-08-17T05:00:00.000Z',
    );
  });

  it('delays a message after midnight until the same local morning', () => {
    const now = new Date('2026-08-17T02:00:00.000Z'); // 05:00 Moscow
    expect(service.nextAllowedAt(now, 'Europe/Moscow', overnight).toISOString()).toBe(
      '2026-08-17T05:00:00.000Z',
    );
  });

  it('supports a same-day quiet interval', () => {
    const now = new Date('2026-08-16T10:30:00.000Z'); // 13:30 Moscow
    const preference = {
      quietHoursEnabled: true,
      quietHoursStart: '13:00',
      quietHoursEnd: '15:00',
    };
    expect(service.nextAllowedAt(now, 'Europe/Moscow', preference).toISOString()).toBe(
      '2026-08-16T12:00:00.000Z',
    );
  });

  it('uses the post-transition offset at a DST boundary', () => {
    const now = new Date('2026-03-29T00:30:00.000Z'); // 01:30 Europe/Berlin
    const preference = {
      quietHoursEnabled: true,
      quietHoursStart: '00:00',
      quietHoursEnd: '04:00',
    };
    expect(service.nextAllowedAt(now, 'Europe/Berlin', preference).toISOString()).toBe(
      '2026-03-29T02:00:00.000Z',
    );
  });
});
