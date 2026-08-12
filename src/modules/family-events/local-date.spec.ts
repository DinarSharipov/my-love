import { localDateStartUtc } from './local-date';

describe('localDateStartUtc', () => {
  it('converts Moscow local midnight to UTC', () => {
    expect(localDateStartUtc('2026-08-01', 'Europe/Moscow').toISOString()).toBe(
      '2026-07-31T21:00:00.000Z',
    );
  });

  it('handles a timezone with daylight saving time', () => {
    expect(localDateStartUtc('2026-08-01', 'Europe/Berlin').toISOString()).toBe(
      '2026-07-31T22:00:00.000Z',
    );
  });
});
