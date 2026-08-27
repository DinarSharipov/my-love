import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import {
  FamilyWishApprovalStatus,
  FamilyWishImplementationStatus,
  FamilyWishRealizationConfirmationStatus,
} from '@prisma/client';
import { FamilyWishesService } from './family-wishes.service';

describe('FamilyWishesService', () => {
  const membership = { requirePartner: jest.fn() };
  const notifications = { notifyUserInTransaction: jest.fn() };
  const prisma = {
    familyMember: { findFirst: jest.fn() },
    familyWish: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findFirstOrThrow: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const service = new FamilyWishesService(
    prisma as never,
    membership as never,
    notifications as never,
  );

  const wish = {
    id: 'wish-1',
    familyId: 'family-1',
    createdById: 'user-1',
    partnerId: 'user-2',
    title: 'Путешествие',
    description: null,
    implementationStatus: FamilyWishImplementationStatus.NOT_REALIZED,
    partnerApprovalStatus: FamilyWishApprovalStatus.PENDING,
    realizationConfirmationStatus: FamilyWishRealizationConfirmationStatus.NOT_REQUESTED,
    realizedById: null,
    realizedAt: null,
    deletedAt: null,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: { id: 'user-1', firstName: 'A', lastName: 'One' },
    partner: { id: 'user-2', firstName: 'B', lastName: 'Two' },
    realizedBy: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((callback: (tx: typeof prisma) => unknown) =>
      callback(prisma),
    );
    membership.requirePartner.mockResolvedValue({ familyId: 'family-1' });
    notifications.notifyUserInTransaction.mockResolvedValue(undefined);
  });

  it('rejects self-targeting and non-family partner', async () => {
    await expect(
      service.create('user-1', { title: 'x', partnerId: 'user-1' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.familyMember.findFirst.mockResolvedValue(null);
    await expect(
      service.create('user-1', { title: 'x', partnerId: 'user-2' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('creates a pending wish and queues notification in the same transaction', async () => {
    prisma.familyMember.findFirst.mockResolvedValue({ userId: 'user-2' });
    prisma.familyWish.create.mockResolvedValue(wish);

    await expect(
      service.create('user-1', { title: wish.title, partnerId: wish.partnerId }),
    ).resolves.toMatchObject({
      id: wish.id,
      partnerApprovalStatus: FamilyWishApprovalStatus.PENDING,
    });
    expect(notifications.notifyUserInTransaction).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ userId: 'user-2', type: 'FAMILY_WISH_CREATED' }),
    );
  });

  it('does not allow realization before partner approval', async () => {
    prisma.familyWish.findFirst.mockResolvedValue(wish);
    await expect(service.markRealized('user-1', wish.id)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.familyWish.updateMany).not.toHaveBeenCalled();
  });

  it('requires the assigned partner to confirm realization', async () => {
    prisma.familyWish.findFirst.mockResolvedValue({
      ...wish,
      partnerApprovalStatus: FamilyWishApprovalStatus.ACCEPTED,
      implementationStatus: FamilyWishImplementationStatus.REALIZED,
      realizationConfirmationStatus: FamilyWishRealizationConfirmationStatus.PENDING,
    });
    await expect(service.confirmRealization('user-1', wish.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
