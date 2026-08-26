type CorsOriginCallback = (error: Error | null, allow?: boolean) => void;

export function corsOrigins(): string[] {
  return (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function isCorsOriginAllowed(origin?: string): boolean {
  // Non-browser clients (health checks, server-to-server Socket.IO) do not send Origin.
  if (!origin) return true;
  return corsOrigins().includes(origin);
}

export function validateCorsOrigin(origin: string | undefined, callback: CorsOriginCallback): void {
  callback(null, isCorsOriginAllowed(origin));
}
