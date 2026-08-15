import { ForbiddenException } from '@nestjs/common';
import { FamilyMemberRole, FamilyStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { FamilyMembershipService } from './family-membership.service';

describe('FamilyMembershipService', () => {
  const userId = '2aa49af8-40fc-4f36-bb9d-246febd3dbe9';
  const activeMembership = {
    id: '80dc8de9-fdf3-405e-b40d-d4399d2474bc',
    familyId: '4628fd76-11ad-41b3-a5de-6561cbc030d6',
    role: FamilyMemberRole.PARTNER,
    family: {
      status: FamilyStatus.ACTIVE,
      timeZone: 'Europe/Moscow',
      locale: 'ru-RU',
      defaultCurrency: 'RUB',
    },
  };

  function createService(result: object | null): FamilyMembershipService {
    const prisma = {
      familyMember: { findUnique: jest.fn().mockResolvedValue(result) },
    };
    return new FamilyMembershipService(prisma as unknown as PrismaService);
  }

  it('returns the active family context', async () => {
    await expect(createService(activeMembership).requirePartner(userId)).resolves.toEqual({
      familyId: activeMembership.familyId,
      memberId: activeMembership.id,
      role: FamilyMemberRole.PARTNER,
      timeZone: 'Europe/Moscow',
      locale: 'ru-RU',
      defaultCurrency: 'RUB',
    });
  });

  it('rejects a user without a membership', async () => {
    await expect(createService(null).requireMembership(userId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects a membership in a non-active family', async () => {
    const archived = {
      ...activeMembership,
      family: { ...activeMembership.family, status: FamilyStatus.ARCHIVED },
    };
    await expect(createService(archived).requireMembership(userId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects a child for partner-only operations', async () => {
    const child = { ...activeMembership, role: FamilyMemberRole.CHILD };
    await expect(createService(child).requirePartner(userId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
