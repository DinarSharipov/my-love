import { MaintenanceService } from './maintenance.service';

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
    const service = new MaintenanceService(prisma as never, {} as never, {} as never, {} as never);

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

  it('removes wellbeing consents atomically before anonymizing an expired account', async () => {
    const user = {
      findMany: jest.fn().mockResolvedValue([{ id: 'deleted-user-id' }]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    };
    const wellbeingConsentGrant = { deleteMany: jest.fn() };
    const notification = { deleteMany: jest.fn() };
    const notificationPreference = { deleteMany: jest.fn() };
    const telegramConnection = { deleteMany: jest.fn() };
    const telegramLinkToken = { deleteMany: jest.fn() };
    const outboxEvent = { deleteMany: jest.fn() };
    const prisma = {
      user,
      wellbeingConsentGrant,
      notification,
      notificationPreference,
      telegramConnection,
      telegramLinkToken,
      outboxEvent,
      $transaction: jest.fn((callback: (tx: unknown) => unknown) =>
        callback({
          wellbeingConsentGrant,
          notification,
          notificationPreference,
          telegramConnection,
          telegramLinkToken,
          outboxEvent,
          user,
        }),
      ),
    };
    const service = new MaintenanceService(prisma as never, {} as never, {} as never, {} as never);
    const now = new Date('2026-08-20T00:00:00Z');

    await expect(service.anonymizeExpiredAccounts(now)).resolves.toEqual({ anonymizedUsers: 1 });
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { isActive: false, retentionAnonymizedAt: null, deletionScheduledAt: { lte: now } },
      select: { id: true },
      take: 100,
    });
    expect(prisma.wellbeingConsentGrant.deleteMany).toHaveBeenCalledWith({
      where: { OR: [{ ownerId: 'deleted-user-id' }, { recipientId: 'deleted-user-id' }] },
    });
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'deleted-user-id' },
    });
    expect(prisma.notificationPreference.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'deleted-user-id' },
    });
    expect(prisma.telegramConnection.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'deleted-user-id' },
    });
    expect(prisma.telegramLinkToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'deleted-user-id' },
    });
    expect(prisma.outboxEvent.deleteMany).toHaveBeenCalledWith({
      where: {
        type: 'telegram.notify',
        status: 'PENDING',
        payload: { path: ['recipientUserId'], equals: 'deleted-user-id' },
      },
    });
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'deleted-user-id', isActive: false, retentionAnonymizedAt: null },
      data: {
        firstName: 'Удалённый',
        lastName: 'Пользователь',
        email: 'deleted+deleted-user-id@invalid.local',
        description: null,
        phone: null,
        birthDate: new Date('1970-01-01T00:00:00.000Z'),
        retentionAnonymizedAt: now,
      },
    });
  });
});
