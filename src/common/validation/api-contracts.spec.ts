import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MoneyDto } from '../dto/money.dto';
import { IsIsoInstant, IsLocalDate } from './date-time.decorators';
import { IsIanaTimeZone } from './iana-time-zone.decorator';

class DateTimeContractDto {
  @IsLocalDate() localDate: string;
  @IsIsoInstant() instant: string;
  @IsIanaTimeZone() timeZone: string;
}

describe('shared API contracts', () => {
  it('accepts explicit local date, instant and timezone values', async () => {
    const dto = plainToInstance(DateTimeContractDto, {
      localDate: '2026-08-15',
      instant: '2026-08-15T12:30:00.000Z',
      timeZone: 'Europe/Moscow',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects a calendar date used as an instant and an unknown timezone', async () => {
    const dto = plainToInstance(DateTimeContractDto, {
      localDate: '2026-02-30',
      instant: '2026-08-15',
      timeZone: 'Mars/Olympus',
    });

    await expect(validate(dto)).resolves.toHaveLength(3);
  });

  it('uses a decimal string for lossless minor-unit money amounts', async () => {
    const valid = plainToInstance(MoneyDto, {
      amountMinor: '900719925474099300',
      currency: 'RUB',
      scale: 2,
    });
    const invalid = plainToInstance(MoneyDto, {
      amountMinor: 100.5,
      currency: 'rub',
      scale: -1,
    });

    await expect(validate(valid)).resolves.toHaveLength(0);
    await expect(validate(invalid)).resolves.toHaveLength(3);
  });
});
