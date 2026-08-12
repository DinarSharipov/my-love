import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Gender, Prisma, User } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { FirstDateEntity } from './dto/first-date-response.dto';
import { FirstDateService } from './first-date.service';

describe('FirstDateService', () => {
  const creatorId = '2aa49af8-40fc-4f36-bb9d-246febd3dbe9';
  const partnerId = '76c40452-1f1d-4181-a15a-ec7ae187fbe4';
  const familyId = '4628fd76-11ad-41b3-a5de-6561cbc030d6';

  const creator: User = {
    id: creatorId,
    firstName: 'Иван',
    lastName: 'Иванов',
    email: 'ivan@example.com',
    passwordHash: null,
    gender: Gender.MALE,
    description: null,
    birthDate: new Date('1995-05-20'),
    phone: null,
    isActive: true,
    createdAt: new Date('2026-08-12T10:00:00.000Z'),
    updatedAt: new Date('2026-08-12T10:00:00.000Z'),
  };

  const firstDate: FirstDateEntity = {
    id: '931331ac-6404-43bd-af06-3259b65c18f1',
    familyId,
    createdById: creatorId,
    name: 'Наше первое свидание',
    date: new Date('2024-08-15T00:00:00.000Z'),
    description: 'Прогулка и ужин',
    createdAt: new Date('2026-08-12T10:00:00.000Z'),
    updatedAt: new Date('2026-08-12T10:00:00.000Z'),
    createdBy: creator,
  };

  it('maps the family uniqueness violation to a conflict', async () => {
    const prisma = {
      familyMember: { findUnique: jest.fn().mockResolvedValue({ familyId }) },
      firstDate: {
        create: jest.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
            code: 'P2002',
            clientVersion: '6.19.3',
          }),
        ),
      },
    };
    const service = new FirstDateService(prisma as unknown as PrismaService);

    await expect(
      service.create(creatorId, {
        name: firstDate.name,
        date: '2024-08-15',
        description: firstDate.description ?? undefined,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('allows either family member to update the first date', async () => {
    const prisma = {
      familyMember: { findUnique: jest.fn().mockResolvedValue({ familyId }) },
      firstDate: {
        findUnique: jest.fn().mockResolvedValue({ id: firstDate.id }),
        update: jest.fn().mockResolvedValue({ ...firstDate, name: 'Новая подпись' }),
      },
    };
    const service = new FirstDateService(prisma as unknown as PrismaService);

    const result = await service.update(partnerId, { name: 'Новая подпись' });

    expect(result.name).toBe('Новая подпись');
    expect(prisma.firstDate.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { familyId }, data: { name: 'Новая подпись' } }),
    );
  });

  it('rejects an update without fields', async () => {
    const prisma = {
      familyMember: { findUnique: jest.fn().mockResolvedValue({ familyId }) },
    };
    const service = new FirstDateService(prisma as unknown as PrismaService);

    await expect(service.update(partnerId, {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows only the creator to delete the first date', async () => {
    const prisma = {
      familyMember: { findUnique: jest.fn().mockResolvedValue({ familyId }) },
      firstDate: { findUnique: jest.fn().mockResolvedValue({ createdById: creatorId }) },
    };
    const service = new FirstDateService(prisma as unknown as PrismaService);

    await expect(service.remove(partnerId)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
