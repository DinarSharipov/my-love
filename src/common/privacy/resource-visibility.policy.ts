export enum ResourceVisibility {
  PRIVATE = 'PRIVATE',
  PARTNER = 'PARTNER',
  FAMILY = 'FAMILY',
}

export interface ConsentSnapshot {
  grantedAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
  scopes: readonly string[];
}

export interface ResourceReadContext {
  actorId: string;
  ownerId: string;
  actorFamilyId: string | null;
  resourceFamilyId: string | null;
  visibility: ResourceVisibility;
  requiredScope?: string;
  consent?: ConsentSnapshot | null;
  now?: Date;
}

export function canReadResource(context: ResourceReadContext): boolean {
  if (context.actorId === context.ownerId) return true;
  if (context.visibility === ResourceVisibility.PRIVATE) return false;
  if (
    !context.actorFamilyId ||
    !context.resourceFamilyId ||
    context.actorFamilyId !== context.resourceFamilyId
  ) {
    return false;
  }
  if (!context.requiredScope) return true;
  const consent = context.consent;
  if (!consent || consent.revokedAt) return false;
  const now = context.now ?? new Date();
  if (consent.grantedAt > now || (consent.expiresAt && consent.expiresAt <= now)) return false;
  return consent.scopes.includes(context.requiredScope);
}
