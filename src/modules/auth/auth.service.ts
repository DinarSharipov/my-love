import { createHash, randomUUID } from 'node:crypto';
import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../../database/prisma.service';
import { UsersService } from '../users/users.service';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import type { JwtPayload } from './types/jwt-payload.type';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) throw new ConflictException('User with this email already exists');

    try {
      const user = await this.usersService.create({
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        email: dto.email,
        passwordHash: await argon2.hash(dto.password, { type: argon2.argon2id }),
        gender: dto.gender,
        description: dto.description?.trim() || null,
        birthDate: new Date(dto.birthDate),
        phone: dto.phone?.trim() || null,
      });
      return this.issueAccessToken(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('User with this email already exists');
      }
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.usersService.findByEmail(dto.email);
    if (
      !user ||
      !user.isActive ||
      !user.passwordHash ||
      !(await argon2.verify(user.passwordHash, dto.password))
    ) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.issueAccessToken(user);
  }

  async logout(tokenHash: string): Promise<void> {
    await this.prisma.authSession.deleteMany({ where: { tokenHash } });
  }

  private async issueAccessToken(
    user: Awaited<ReturnType<UsersService['create']>>,
  ): Promise<AuthResponseDto> {
    const jti = randomUUID();
    const tokenHash = createHash('sha256').update(jti).digest('hex');
    const expiresInValue = this.config.getOrThrow<string>('JWT_ACCESS_EXPIRES_IN');
    const expiresIn = this.durationToSeconds(expiresInValue);
    const payload: JwtPayload = { sub: user.id, email: user.email, jti };

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn,
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
    await this.prisma.authSession.create({
      data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + expiresIn * 1000) },
    });

    return { accessToken, tokenType: 'Bearer', expiresIn, user: UserResponseDto.fromEntity(user) };
  }

  private durationToSeconds(value: string): number {
    const match = /^(\d+)([smhdw])$/.exec(value);
    if (!match) throw new Error('JWT_ACCESS_EXPIRES_IN has invalid format');
    const multipliers = { s: 1, m: 60, h: 3600, d: 86400, w: 604800 };
    return Number(match[1]) * multipliers[match[2] as keyof typeof multipliers];
  }
}
