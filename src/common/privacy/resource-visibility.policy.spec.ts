import {
  canReadResource,
  ResourceVisibility,
  type ConsentSnapshot,
} from './resource-visibility.policy';

describe('resource visibility policy', () => {
  const now = new Date('2026-08-16T10:00:00.000Z');
  const activeConsent: ConsentSnapshot = {
    grantedAt: new Date('2026-08-15T10:00:00.000Z'),
    expiresAt: new Date('2026-08-17T10:00:00.000Z'),
    revokedAt: null,
    scopes: ['mood', 'supportRequest'],
  };

  it('always allows the owner and keeps private resources owner-only', () => {
    expect(
      canReadResource({
        actorId: 'owner-id',
        ownerId: 'owner-id',
        actorFamilyId: null,
        resourceFamilyId: null,
        visibility: ResourceVisibility.PRIVATE,
      }),
    ).toBe(true);
    expect(
      canReadResource({
        actorId: 'partner-id',
        ownerId: 'owner-id',
        actorFamilyId: 'family-id',
        resourceFamilyId: 'family-id',
        visibility: ResourceVisibility.PRIVATE,
      }),
    ).toBe(false);
  });

  it('requires the same active family boundary for shared visibility', () => {
    expect(
      canReadResource({
        actorId: 'partner-id',
        ownerId: 'owner-id',
        actorFamilyId: 'family-id',
        resourceFamilyId: 'family-id',
        visibility: ResourceVisibility.PARTNER,
      }),
    ).toBe(true);
    expect(
      canReadResource({
        actorId: 'outsider-id',
        ownerId: 'owner-id',
        actorFamilyId: 'other-family-id',
        resourceFamilyId: 'family-id',
        visibility: ResourceVisibility.FAMILY,
      }),
    ).toBe(false);
  });

  it('requires a current unrevoked consent with the requested scope', () => {
    const base = {
      actorId: 'partner-id',
      ownerId: 'owner-id',
      actorFamilyId: 'family-id',
      resourceFamilyId: 'family-id',
      visibility: ResourceVisibility.PARTNER,
      requiredScope: 'mood',
      now,
    };
    expect(canReadResource({ ...base, consent: activeConsent })).toBe(true);
    expect(
      canReadResource({
        ...base,
        consent: { ...activeConsent, revokedAt: new Date('2026-08-16T09:00:00.000Z') },
      }),
    ).toBe(false);
    expect(
      canReadResource({
        ...base,
        consent: { ...activeConsent, expiresAt: now },
      }),
    ).toBe(false);
    expect(canReadResource({ ...base, requiredScope: 'privateNote', consent: activeConsent })).toBe(
      false,
    );
  });
});
