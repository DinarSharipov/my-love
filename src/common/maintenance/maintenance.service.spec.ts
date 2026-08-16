import { MaintenanceService } from './maintenance.service';
import { QuietHoursService } from '../notifications/quiet-hours.service';

describe('MaintenanceService', () => {
  it('removes expired security artifacts and expires invitations', async () => {
    const prisma = {
      authSession: { deleteMany: jest.fn().mockReturnValue({}) },
      passwordResetToken: { deleteMany: jest.fn().mockReturnValue({}) },
      emailChangeToken: { deleteMany: jest.fn().mockReturnValue({}) },
      accountDeletionToken: { deleteMany: jest.fn().mockReturnValue({}) },
      telegramLinkToken: { deleteMany: jest.fn().mockReturnValue({}) },
      familyInvitation: { updateMany: jest.fn().mockReturnValue({}) },
      privateFamilyInvitation: { updateMany: jest.fn().mockReturnValue({}) },
      $transaction: jest
        .fn()
        .mockResolvedValue([
          { count: 2 },
          { count: 1 },
          { count: 3 },
          { count: 4 },
          { count: 7 },
          { count: 5 },
          { count: 6 },
        ]),
    };
    const service = new MaintenanceService(
      prisma as never,
      {} as never,
      new QuietHoursService(),
      {} as never,
    );

    await expect(
      service.cleanupExpiredSecurityArtifacts(new Date('2026-08-15T00:00:00Z')),
    ).resolves.toEqual({
      sessions: 2,
      passwordResetTokens: 1,
      emailChangeTokens: 3,
      accountDeletionTokens: 4,
      telegramLinkTokens: 7,
      familyInvitations: 5,
      privateInvitations: 6,
    });
    expect(prisma.authSession.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lte: new Date('2026-08-15T00:00:00Z') } },
    });
  });
});
