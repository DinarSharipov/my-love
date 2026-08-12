function zonedPartsTimestamp(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );
}

export function localDateStartUtc(date: string, timeZone: string): Date {
  const utcMidnight = new Date(`${date}T00:00:00.000Z`);
  let candidate = new Date(
    utcMidnight.getTime() - (zonedPartsTimestamp(utcMidnight, timeZone) - utcMidnight.getTime()),
  );
  candidate = new Date(
    candidate.getTime() - (zonedPartsTimestamp(candidate, timeZone) - utcMidnight.getTime()),
  );
  return candidate;
}
