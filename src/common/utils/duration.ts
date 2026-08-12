export function durationToSeconds(value: string): number {
  const match = /^(\d+)([smhdw])$/.exec(value);
  if (!match) throw new Error(`Invalid duration: ${value}`);

  const multipliers = { s: 1, m: 60, h: 3600, d: 86_400, w: 604_800 };
  return Number(match[1]) * multipliers[match[2] as keyof typeof multipliers];
}
