import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Gender, User } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../../database/prisma.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const user: User = {
    id: '23a9806a-a797-43bb-8794-d0209f50bdf6',
    firstName: 'Иван',
    lastName: 'Иванов',
    email: 'ivan@example.com',
    passwordHash: '',
    gender: Gender.MALE,
    description: null,
    birthDate: new Date('1995-05-20'),
    phone: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('creates a revocable session when login succeeds', async () => {
    const passwordHash = await argon2.hash('StrongPassword123!');
    const usersService = { findByEmail: jest.fn().mockResolvedValue({ ...user, passwordHash }) };
    const prisma = {
      authSession: { create: jest.fn().mockResolvedValue({}), deleteMany: jest.fn() },
    };
    const jwt = { signAsync: jest.fn().mockResolvedValue('signed.jwt.token') };
    const config = {
      getOrThrow: jest.fn((key: string) =>
        key === 'JWT_ACCESS_EXPIRES_IN' ? '7d' : 'a-secret-longer-than-thirty-two-characters',
      ),
    };
    const service = new AuthService(
      usersService as unknown as UsersService,
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
      config as unknown as ConfigService,
    );

    const result = await service.login({ email: user.email, password: 'StrongPassword123!' });

    expect(result.accessToken).toBe('signed.jwt.token');
    expect(result.expiresIn).toBe(604800);
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(prisma.authSession.create).toHaveBeenCalledTimes(1);
  });

  it('removes the current session on logout', async () => {
    const prisma = { authSession: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) } };
    const service = new AuthService(
      {} as UsersService,
      prisma as unknown as PrismaService,
      {} as JwtService,
      {} as ConfigService,
    );

    await service.logout('token-hash');

    expect(prisma.authSession.deleteMany).toHaveBeenCalledWith({
      where: { tokenHash: 'token-hash' },
    });
  });
});
