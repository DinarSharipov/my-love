import { Injectable } from '@nestjs/common';

export interface QuietHoursPreference {
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
}

interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

@Injectable()
export class QuietHoursService {
  nextAllowedAt(
    now: Date,
    timeZone: string,
    preference: QuietHoursPreference | null | undefined,
  ): Date {
    if (
      !preference?.quietHoursEnabled ||
      !preference.quietHoursStart ||
      !preference.quietHoursEnd ||
      preference.quietHoursStart === preference.quietHoursEnd
    ) {
      return now;
    }

    const local = this.localParts(now, timeZone);
    const currentMinute = local.hour * 60 + local.minute;
    const startMinute = this.minuteOfDay(preference.quietHoursStart);
    const endMinute = this.minuteOfDay(preference.quietHoursEnd);
    const crossesMidnight = startMinute > endMinute;
    const inside = crossesMidnight
      ? currentMinute >= startMinute || currentMinute < endMinute
      : currentMinute >= startMinute && currentMinute < endMinute;
    if (!inside) return now;

    const endHour = Math.floor(endMinute / 60);
    const endMinutePart = endMinute % 60;
    const targetDate =
      crossesMidnight && currentMinute >= startMinute ? this.nextDate(local) : local;
    return this.localTimeToInstant(
      { ...targetDate, hour: endHour, minute: endMinutePart },
      timeZone,
    );
  }

  private minuteOfDay(value: string): number {
    const [hour, minute] = value.split(':').map(Number);
    return hour * 60 + minute;
  }

  private nextDate(value: LocalParts): LocalParts {
    const date = new Date(Date.UTC(value.year, value.month - 1, value.day + 1));
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour: 0,
      minute: 0,
    };
  }

  private localParts(value: Date, timeZone: string): LocalParts {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(value);
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value);
    return {
      year: get('year'),
      month: get('month'),
      day: get('day'),
      hour: get('hour'),
      minute: get('minute'),
    };
  }

  private localTimeToInstant(target: LocalParts, timeZone: string): Date {
    const targetAsUtc = Date.UTC(
      target.year,
      target.month - 1,
      target.day,
      target.hour,
      target.minute,
    );
    let candidate = targetAsUtc;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const actual = this.localParts(new Date(candidate), timeZone);
      const actualAsUtc = Date.UTC(
        actual.year,
        actual.month - 1,
        actual.day,
        actual.hour,
        actual.minute,
      );
      const correction = targetAsUtc - actualAsUtc;
      if (correction === 0) return new Date(candidate);
      candidate += correction;
    }

    // A DST jump can make a configured local minute nonexistent. In that case,
    // delivery resumes at the first representable local minute after the boundary.
    for (let offsetMinutes = -180; offsetMinutes <= 180; offsetMinutes += 1) {
      const instant = new Date(candidate + offsetMinutes * 60_000);
      const actual = this.localParts(instant, timeZone);
      const sameDate =
        actual.year === target.year && actual.month === target.month && actual.day === target.day;
      if (sameDate && actual.hour * 60 + actual.minute >= target.hour * 60 + target.minute) {
        return instant;
      }
    }
    throw new Error(`Unable to resolve quiet-hours boundary in timezone ${timeZone}`);
  }
}
